// Define the zone to select (e.g., 'A', 'UM', etc.)
const zonePrefix = 'C'; // Set to 'A' to select zone A

// Click the button to open the available seats
const button = document.getElementById('popup-avail');
if (button) {
    button.click();

    // Wait for the data to load
    waitForDataToLoad().then(() => selectZoneWithMostSeats(zonePrefix));
} else {
    console.error('Button not found.');
}

// Function to wait for data to load
function waitForDataToLoad() {
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && document.querySelector('tr')) {
                    observer.disconnect();
                    resolve();
                    break;
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Timeout if data doesn't load within a reasonable time
        setTimeout(() => {
            observer.disconnect();
            resolve();
        }, 1000); // 1000 milliseconds timeout
    });
}

// Function to select the zone with the most seats
function selectZoneWithMostSeats(zonePrefix) {
    const rows = document.querySelectorAll('tr');
    let bestRow = null;
    let maxSeats = 0;

    rows.forEach(row => {
        // Extract zone ID and number of seats
        const zoneElement = row.querySelector('td:nth-child(1) a');
        const seatsElement = row.querySelector('td:nth-child(2) a');
        
        if (zoneElement && seatsElement) {
            const zoneId = zoneElement.id;
            const seatsCount = parseInt(seatsElement.textContent, 10);

            // Check if the zone ID starts with the specified prefix
            if (zoneId.startsWith(zonePrefix)) {
                // Update the bestRow if this row has more seats
                if (seatsCount > maxSeats) {
                    maxSeats = seatsCount;
                    bestRow = row;
                }
            }
        }
    });

    if (bestRow) {
        // Click the row with the most seats
        bestRow.click();
        const zoneId = bestRow.querySelector('td:nth-child(1) a').id;
        gonextstep('fixed.php', zoneId, event); // Assuming gonextstep() is already defined
        console.log(`Selected row with zone ID: ${bestRow.querySelector('td:nth-child(1) a').id} and seats: ${maxSeats}`);
    } else {
        // If no zone with the prefix was found, display an error message in the console
        console.error(`No available seats found in zone ${zonePrefix}.`);
    }
}
