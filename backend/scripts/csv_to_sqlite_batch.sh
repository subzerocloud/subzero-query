#!/bin/bash

check_if_archive() {
    file_path="$1"

    # Check if the file is an archive
    file_type=$(file --mime-type -b "$file_path")

    case "$file_type" in
        "application/zip" | "application/gzip" | "application/x-tar" | "application/x-gtar")
            true
            ;;
        *)
            false
            ;;
    esac
}

csv_to_sqlite() {
filename="$1"

if check_if_archive "$filename"; then
    # skip archive files
    retrun 0
fi

# Get the header row of the CSV file
header=$(head -n 1 "$filename" | LC_ALL=C sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

# Determine the number of columns in the CSV file
num_columns=$(echo "$header" | awk -F "," '{print NF}')

# Analyze the first few rows to determine the appropriate data types for each column
num_rows_to_analyze=5
column_types=()
for (( i=1; i<=num_columns; i++ )); do
    column_data=$(tail -n +2 "$filename" | head -n "$num_rows_to_analyze" | awk -F "," -v col="$i" '{print $col}')
    is_numeric=1
    is_integer=1
    for value in $column_data; do
        if ! [[ $value =~ ^[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?$ ]]; then
            is_numeric=0
            break
        elif ! [[ $value =~ ^[-+]?[0-9]+$ ]]; then
            is_integer=0
        fi
    done
    if [ $is_numeric -eq 1 ]; then
        if [ $is_integer -eq 1 ]; then
            column_types+=("INTEGER")
        else
            column_types+=("REAL")
        fi
    else
        column_types+=("TEXT")
    fi
done

# Generate the SQL statement to create the table
create_table_sql="CREATE TABLE dataset ("
for (( i=1; i<=num_columns; i++ )); do
    column_name=$(echo "$header" | awk -F "," '{print $'"$i"'}')
    # Remove new lines and quotes from the column name
    stripped_name=$(echo "$column_name" | tr -cd '[:alnum:][:space:]-_')

    # echo if the column name was changed
    if [ "$column_name" != "$stripped_name" ]; then
        echo "Stripped column name: $column_name -> $stripped_name"
        column_name="$stripped_name"
    fi

    create_table_sql="$create_table_sql \"$column_name\" ${column_types[$((i-1))]},"
done
create_table_sql="${create_table_sql%?});"

sqlite_file="${filename%.csv}.db"

# Remove the sqlite database if it already exists
if [ -f "$sqlite_file" ]; then
    echo "Removing existing sqlite database"
    rm "$sqlite_file"
fi

# Create a new SQLite database with the same name as the CSV file
echo "Creating sqlite database"
echo "$create_table_sql"
sqlite3 "${sqlite_file}" "$create_table_sql"

# Load the data from the CSV file into the database
echo "Loading data into sqlite database"
sqlite3 "${sqlite_file}" <<EOF
.import --csv --skip 1 "$filename" dataset
EOF
}

# Directory to scan for CSV files
dir_to_scan="$1"

if [ -z "$dir_to_scan" ]; then
    echo "Usage: $0 <directory_to_scan>"
    exit 1
fi

# Scan the directory for CSV files
for csv_file in "$dir_to_scan"/*.csv; do
    sqlite_file="${csv_file%.csv}.db"

    # Check if the SQLite file is missing or older than the CSV file
    if [ ! -f "$sqlite_file" ] || [ "$csv_file" -nt "$sqlite_file" ]; then
        echo "Processing $csv_file"
        csv_to_sqlite "$csv_file"
    else
        echo "Skipping $csv_file (SQLite database is up-to-date)"
    fi
done
