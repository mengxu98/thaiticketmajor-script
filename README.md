## Introduction

> [!IMPORTANT]
> Now, Thaiticketmajor website has been updated and added some security features.
> This `Python` script is no longer working when login (deleted usage of `Python` script).
> JavaScript is tested offline; live-site compatibility is unverified.

This repository contains an automation `Python` script and `JavaScript` script for booking concert tickets on Thaiticketmajor website.

## Usage

1. Log in to `Thaiticketmajor` and open the seat-selection page for your zone (see below).
2. Clear any selected seats and close any dialogs.
3. Set `requiredSeats` in `js/4.select-seats.js` before running (default: 1).
4. Paste the script into the browser's developer console.
5. Press Enter to select seats and click the confirmation button automatically.

Stop with `ttmSeatSelector.stop()`; selected seats remain selected.

![usage](/img/seat.png)

## Acknowledgement
This project is based on [Arkaradet's](https://github.com/Arkaradet/reserving_concert-main) and [8xecute's](https://github.com/8xecute/Thaiticketmajor-script) works, and I just modify to my needs. If you have use this script, please consider giving them a star.
