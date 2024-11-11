let selectedSeats = [];
const requiredSeats = 1; // Number of adjacent seats required

function closeAlertIfNeeded() {
    let alertButton = document.querySelector("button.btn-red.w-auto[onclick='MessageClose()']");
    if (alertButton) {
        alertButton.click();
    }
}

function areSeatsAdjacent(seats) {
    if (seats.length < requiredSeats) return false;

    // Extract rows and check if all seats are in the same row
    const rows = seats.map(seat => seat.split('-')[0]);
    const uniqueRows = [...new Set(rows)];

    if (uniqueRows.length !== 1) return false;

    // Check if seats are consecutive
    const seatNumbers = seats.map(seat => parseInt(seat.split('-')[1], 10));
    seatNumbers.sort((a, b) => a - b);

    for (let i = 1; i < seatNumbers.length; i++) {
        if (seatNumbers[i] !== seatNumbers[i - 1] + 1) return false;
    }
    return true;
}

function selectAdjacentSeats() {
    let rows = document.querySelectorAll("#tableseats tbody tr");
    let seatsFound = false;
    let totalSeats = 0;
    let noSeatsFound = true;

    for (let i = 0; i < rows.length; i++) {
        let columns = rows[i].querySelectorAll("td");
        let adjacentSeats = [];

        for (let j = 1; j < columns.length; j++) { // Start at j=1 to skip the first column
            let seatDiv = columns[j].querySelector("div.seatuncheck");
            let seatId = columns[j].getAttribute("title");

            if (seatDiv && !columns[j].classList.contains("not-available")) {
                adjacentSeats.push(seatId);

                if (adjacentSeats.length === requiredSeats) {
                    if (areSeatsAdjacent(adjacentSeats)) {
                        // Attempt to select seats
                        adjacentSeats.forEach(seat => {
                            let seatElement = document.getElementById(`checkseat-${seat}`);
                            if (seatElement && !seatElement.classList.contains("seatchecked")) {
                                seatElement.click();
                            }
                        });

                        // Wait for a moment to handle potential alerts
                        setTimeout(() => {
                            closeAlertIfNeeded();

                            // Check if the seats are successfully selected
                            let selectedSeatElements = adjacentSeats.every(seat => {
                                let seatElement = document.getElementById(`checkseat-${seat}`);
                                return seatElement && seatElement.classList.contains("seatchecked");
                            });

                            if (selectedSeatElements) {
                                console.log("Selected adjacent seats.");

                                // Click the "ยืนยันที่นั่ง" button to proceed to payment
                                let confirmButton = document.querySelector("a#bookmnow span");
                                if (confirmButton && confirmButton.innerText.trim() === "ยืนยันที่นั่ง") {
                                    confirmButton.click();
                                    console.log("Clicked the 'ยืนยันที่นั่ง' button to proceed to payment.");

                                    // Check for alerts after clicking the button
                                    setTimeout(() => {
                                        let alertButton = document.querySelector("button.btn-red.w-auto[onclick='MessageClose()']");
                                        if (alertButton) {
                                            console.log("Alert detected. Refreshing the page.");
                                            location.reload(); // Refresh the page if alert is detected
                                        }
                                    }, 500); // Short delay to ensure alert is checked after button click
                                } else {
                                    console.error("Confirm button not found.");
                                }

                                selectedSeats = adjacentSeats; // Store selected seats
                                seatsFound = true;
                                return; // Exit if seats are successfully selected and proceed to payment
                            } else {
                                // Reset selection if there was an alert
                                adjacentSeats.forEach(seat => {
                                    let seatElement = document.getElementById(`checkseat-${seat}`);
                                    if (seatElement && seatElement.classList.contains("seatchecked")) {
                                        seatElement.click(); // Deselect
                                    }
                                });
                                console.log("Seats not valid or alert present. Moving to next seats.");
                                adjacentSeats.shift(); // Remove the oldest seat
                                selectAdjacentSeats(); // Re-search for adjacent seats in the same row
                            }
                        }, 200); // Reduced delay

                        return; // Exit the loop if seats are selected
                    } else {
                        adjacentSeats.shift(); // Remove the oldest seat to keep the window size
                    }
                }
            }
        }

        if (seatsFound) {
            noSeatsFound = false;
            break;
        }

        totalSeats += adjacentSeats.length;
    }

    if (noSeatsFound) {
        // If no adjacent seats were found in the current scan, log a message and refresh the page
        console.log("No adjacent seats found in this scan. Refreshing the page.");
        location.reload(); // Refresh the page to start the scanning process again
    } else {
        // Continue scanning the next rows if seats were found
        console.log("Continuing search for adjacent seats.");
        setTimeout(selectAdjacentSeats, 200); // Reduced delay
    }
}

// Start searching for seats
selectAdjacentSeats();
