#!/bin/bash

# Check that the CSV URL is provided as a command line argument
if [ -z "$1" ]; then
  echo "Usage: $0 <csv_url>"
  exit 1
fi

url="$1"

# Download the CSV dataset
echo "Downloading csv"
http_headers=$(curl -L -OJ -D /dev/stdout "$url" 2>/dev/null)

# Remove any leading or trailing whitespace characters
http_headers="$(echo -e "${http_headers}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

# Extract the filename from the Content-Disposition header
filename=$(echo "$http_headers" | grep -o -E 'filename=.*$'|sed -e 's/filename=//')

# If no filename was provided, use the url same as curl would
if [ -z "$filename" ]; then
    filename=$(basename "${url%%\?*}")
fi

# Check that the file was downloaded successfully
if [ ! -f $filename ]; then
    echo "Failed to download $url"
    echo "Checked for $filename existence"
    exit 1
fi

# Get the header row of the CSV file
header=$(head -n 1 "$filename")

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
create_table_sql="CREATE TABLE mytable ("
for (( i=1; i<=num_columns; i++ )); do
    column_name=$(echo "$header" | awk -F "," '{print $'"$i"'}')
    create_table_sql="$create_table_sql \"$column_name\" ${column_types[$((i-1))]},"
done
create_table_sql="${create_table_sql%?});"

# Create a new SQLite database with the same name as the CSV file
echo "Creating sqlite database"
sqlite3 "${filename%.csv}.db" "$create_table_sql"

# Load the data from the CSV file into the database
echo "Loading data into sqlite database"
sqlite3 "${filename%.csv}.db" <<EOF
.import --csv --skip 1 "$filename" mytable
EOF

echo "Done"
