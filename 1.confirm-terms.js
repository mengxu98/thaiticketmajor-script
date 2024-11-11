// Function to check if the checkbox is selected
function isCheckboxChecked() {
    return document.getElementById("rdagree").checked;
}

// Function to click the checkbox and then the button if the checkbox is checked
function clickCheckboxAndProceed() {
    const checkbox = document.getElementById("rdagree");
    const button = document.getElementById("btn_verify");

    // Click the checkbox if it's not already checked
    if (!isCheckboxChecked()) {
        checkbox.click();
        
        // Wait for the checkbox to be checked before proceeding
        const checkInterval = setInterval(() => {
            if (isCheckboxChecked()) {
                clearInterval(checkInterval);
                // Click the button to proceed
                button.click();
            }
        }, 100); // Check every 100ms
    } else {
        // If already checked, click the button immediately
        button.click();
    }
}

// Run the function
clickCheckboxAndProceed();
