import os
import requests
from datetime import datetime, timedelta, timezone

# Paths to the folders containing the JSON files
normal_folder_path = 'data/wordle/guesses_by_round/normal'
hard_folder_path = 'data/wordle/guesses_by_round/hard'

# Ensure directories exist
os.makedirs(normal_folder_path, exist_ok=True)
os.makedirs(hard_folder_path, exist_ok=True)

def get_latest_file_date(folder_path):
    """Get the date of the most recent JSON file in the folder."""
    files = os.listdir(folder_path)
    if not files:
        return None
    
    dates = []
    for file in files:
        # Extract date from filename format: guesses-by-round-mode-YYYY-MM-DD-solution.json
        try:
            date_str = file.split('-')[4:7]  # ['YYYY', 'MM', 'DD']
            dates.append(datetime.strptime('-'.join(date_str), '%Y-%m-%d').date())
        except (IndexError, ValueError):
            continue
    
    return max(dates) if dates else None

# Find the latest date from both normal and hard mode folders
latest_normal = get_latest_file_date(normal_folder_path)
latest_hard = get_latest_file_date(hard_folder_path)

# Use the most recent date from either folder, or fall back to the start date
start_date = max(filter(None, [latest_normal, latest_hard])) + timedelta(days=1) if any([latest_normal, latest_hard]) else start_date

# Initialize an empty list to store the dates
dates_to_process = []

# Continue until we reach today's date
while start_date <= (datetime.now(timezone.utc) - timedelta(hours=12)).date():
    # Add the current date to the list of dates
    dates_to_process.append(start_date)
    # Move to the next day
    start_date += timedelta(days=1)

# Process each date
for date_obj in dates_to_process:
    date_str = date_obj.strftime('%Y-%m-%d')

    # Step 1: Fetch the solution from the Wordle API
    wordle_url = f"https://www.nytimes.com/svc/wordle/v2/{date_str}.json"
    response = requests.get(wordle_url)
    if response.status_code != 200:
        print(f"Failed to fetch data for date {date_str}")
        continue

    data = response.json()
    solution = data['solution']

    print(f"Processing {date_str}: {solution}")

    # Step 2: Fetch both normal and hard mode data
    for mode in ['normal', 'hard']:
        url = f"https://static01.nyt.com/newsgraphics/2022/wordlebot/{solution}-{date_str}/guesses-by-round-{mode}.json"
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Failed to fetch {mode} mode data for solution {solution} on {date_str}")
            continue

        # Step 3: Save the JSON files
        folder_path = normal_folder_path if mode == 'normal' else hard_folder_path
        filename = f"guesses-by-round-{mode}-{date_str}-{solution}.json"
        with open(os.path.join(folder_path, filename), 'w') as f:
            f.write(response.text)

        print(f"Saved {mode} mode data as {filename}")