#!/bin/bash

# ⚠️ The script assumes it is run from the project root path!

# Loop from 0 to 10
for i in $(seq -w 0 10); do
  dir="${i}_*"
  # Find the directory that matches the pattern
  found_dir=$(find . -maxdepth 1 -type d -name "$dir" -print -quit)
  if [[ -n "$found_dir" ]]; then
    # Extract just the folder name, removing './'
    folder_name=$(basename "$found_dir")
    echo "Entering $folder_name and running Deno script..."
    cd "$folder_name"
    deno run --allow-net --allow-read ./scripts/run.ts
    cd ..
    echo "Completed $folder_name."
  else
    echo "Directory matching $dir does not exist."
  fi
  echo ""
done

echo "All tasks completed."
