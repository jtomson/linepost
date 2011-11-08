Linepost
==============

## Overview

Linepost is a lightweight git commit review webapp for teams that features inline (markdown) commenting.

It is built using node.js + sqlite on the server, `lps.js`, and jquery for the browser client, `lpc.js`, with js borrowed from GitX.

## Installation

Clone repo & use NPM to install dependencies:
```bash
$ git clone git@github.com:jtomson/linepost
$ cd linepost
$ npm install
```
Copy the `settings.js` template
```bash
$ cp settings.js.template ./settings.js
```

Edit `settings.js` to point to your local repo(s), and start it up:
```bash
$ node lps.js
```