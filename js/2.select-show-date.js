// Define the day to select (e.g., 'Mon', 'Tue', etc.)
const dayToSelect = 'Wed'; // Set to the day you want to select

// Function to select show date based on the specified day
function selectShowDate(day) {
    // Get the <select> element
    const selectBox = document.getElementById('rdId');
    if (selectBox) {
        // Get all <option> elements
        const options = selectBox.querySelectorAll('option');
        let found = false;

        options.forEach(option => {
            // Check if the option text includes the specified day
            if (option.textContent.includes(day)) {
                selectBox.value = option.value; // Set the selected value
                selectBox.dispatchEvent(new Event('change')); // Trigger change event
                found = true;
                console.log(`Selected show date: ${option.textContent}`);
            }
        });

        // If no matching option is found, log an error
        if (!found) {
            console.error(`No show date found for day: ${day}`);
        }
    } else {
        console.error('Select box not found.');
    }
}

// Call the function with the day to select
selectShowDate(dayToSelect);
