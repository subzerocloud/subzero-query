#!/bin/bash



# Set API endpoint and query parameters
api_endpoint="https://catalog.data.gov/api/3/action/package_search"
query="res_format:CSV"
rows=100
start=0

# Change directory to SQLITE_DATASETS directory if the env var is set
if [ ! -z "$SQLITE_DATASETS" ]; then
    cd "$SQLITE_DATASETS"
fi

CURRENT_DIR=$(pwd)
echo "Downloading csv to $CURRENT_DIR"

progress_file="progress.txt"

# Load progress if exists
if [ -f "${progress_file}" ]; then
  start=$(cut -f1 -d' ' "${progress_file}")
  inner_start=$(cut -f2 -d' ' "${progress_file}")
else
  inner_start=0
fi

# Get total number of datasets
total_datasets=$(curl -s -X GET "${api_endpoint}?q=${query}&rows=1&start=${start}" | jq '.result.count')

echo "Total number of CSV datasets: ${total_datasets}"

# Download datasets
while [ $start -lt $total_datasets ]; do
  echo "Fetching datasets from ${start} to $(( start + rows ))..."
  
  # Get package list
  package_list=$(curl -s -X GET "${api_endpoint}?q=${query}&rows=${rows}&start=${start}")

  # Get number of results in current batch
  current_results=$(echo "${package_list}" | jq '.result.results | length')

  # Download CSV files and save JSON metadata
  for (( i = $inner_start; i < current_results; i++ )); do
    dataset_metadata=$(echo "${package_list}" | jq -c ".result.results[${i}]")
    dataset_name=$(echo "${dataset_metadata}" | jq -r ".name")
    organization_name=$(echo "${dataset_metadata}" | jq -r ".organization.name" | tr -d "[:punct:]" | tr " " "_")
    resources_length=$(echo "${dataset_metadata}" | jq ".resources | length")

    for (( j = 0; j < resources_length; j++ )); do
      resource_format=$(echo "${dataset_metadata}" | jq -r ".resources[${j}].format")

      if [[ "${resource_format}" == "CSV" ]]; then
        resource_url=$(echo "${dataset_metadata}" | jq -r ".resources[${j}].url")
        resource_last_modified=$(echo "${dataset_metadata}" | jq -r ".resources[${j}] | if .last_modified != null then .last_modified elif .metadata_modified != null then .metadata_modified elif .created != null then .created else null end")
        file_name="${organization_name}_${dataset_name}.csv"
        metadata_file_name="${organization_name}_${dataset_name}.json"
        
        if [[ -f "${file_name}" ]]; then
          file_last_modified=$(date -r "${file_name}" +%s)
          if [[ "$(uname)" == "Darwin" ]]; then
              # macOS
              resource_last_modified_epoch=$(date -jf "%Y-%m-%dT%H:%M:%S" "${resource_last_modified}" +%s)
          else
              # Linux
              resource_last_modified_epoch=$(date -d "${resource_last_modified}" +%s)
          fi

          if [[ $resource_last_modified_epoch -gt $file_last_modified ]]; then
            echo "Updating ${file_name} from ${resource_url}"
            http_status_code=$(curl -s -L -w "%{http_code}" -o "${file_name}" "${resource_url}")

            if [[ $http_status_code -ge 400 ]]; then
              echo "Error downloading ${file_name}: HTTP status code ${http_status_code}"
              exit 1
            fi
            
            # Save JSON metadata
            echo "${dataset_metadata}" > "${metadata_file_name}"
          else
            echo "${file_name} is already up-to-date."
          fi
        else
          echo "Downloading ${file_name} from ${resource_url}"
          http_status_code=$(curl -s -L -w "%{http_code}" -o "${file_name}" "${resource_url}")

          if [[ $http_status_code -ge 400 ]]; then
            echo "Error downloading ${file_name}: HTTP status code ${http_status_code}"
            exit 1
          fi
          # Save JSON metadata
          echo "${dataset_metadata}" > "${metadata_file_name}"
        fi

        # Update progress
        echo "${start} $(( i + 1 ))" > "${progress_file}"
        total_progress=$(( start + i + 1 ))
        progress_percentage=$(echo "scale=2; (${total_progress} / ${total_datasets}) * 100" | bc)
        echo "Progress: ${total_progress}/${total_datasets} (${progress_percentage}%)"

        
        # Break from the loop as we found the CSV resource
        break
      fi
    done
    inner_start=0
  done

  # Update progress
  start=$(( start + rows ))
  echo "${start} ${inner_start}" > "${progress_file}"
done

echo "All CSV datasets and their JSON metadata have been downloaded."
