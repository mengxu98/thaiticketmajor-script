# Thai Concert Ticket Automation

An automation tool for booking concert tickets on Thaiticketmajor website.

## Features

- Automatic login to Thaiticketmajor account
- Automated concert session selection
- Smart seating zone selection
- Automatic adjacent seat selection
- Automated order confirmation
- Support for multiple ticket bookings

## Prerequisites

- Python 3.6+
- Chrome browser
- Chrome WebDriver
- Stable internet connection

## Installation

1. Install Python 3
```bash
    python get-pip.py
```
    
* Selenium
```bash
    pip install -U selenium
```

## Usage
```bash
    python py/book_tickets.py
```
    

## User's detail
Edit with text editor or code editor ex.Notes, VSCode
```json
    {
        "email":"email@a.com",
        "pwd":"password",
        "concert":"TRINITY PREMIERE SHOWCASE",
        "zone":"BR",
        "show":"1",
        "seats":"2"
    }
``` 

* ### Concert's name
![name](/img/name.png)


* ### Round of show
![show](/img/show.png)


* ### Zone 
![zone](/img/zone.png)
