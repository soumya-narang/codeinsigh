# codeinsigh

A lightweight, client-side C code analysis tool that breaks down your code the moment you select it — no API, no backend, no waiting.

## What it does

Select any portion of C code and the analysis panel triggers instantly on cursor release. No button clicks. No submissions. Just select and it responds.

You get three views:

- **Analysis** — step-by-step breakdown of what the selected code does, common mistakes you might be making, and why they happen
- **Simulation** — walks through the execution flow of the selected code sequentially
- **Computer POV** — explains how the machine actually interprets the code at a lower level

Everything runs entirely in the browser using client-side JavaScript. No data leaves your machine.

## Why it's different

Most code explanation tools require you to paste code, hit a button, and wait for an API call. Codeinsigh is instantaneous and offline-capable — the intelligence is baked into the client, not fetched from a server.

## Tech stack

- HTML / CSS / JavaScript (vanilla, no frameworks)
- Fully client-side — zero backend, zero API calls

## Live demo

https://soumya-narang.github.io/codeinsigh/

## Status

Active. Currently supports C code analysis. Future scope includes expanding language support and deeper simulation depth.
