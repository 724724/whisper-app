# Whisper App

A minimal desktop application that streamlines the transcription and translation of audio and video files. Built with Electron and TypeScript, Whisper App focuses on an efficient workflow for managing media text without the clutter of built-in recording features.

## Features

- **Project Dashboard**: A clean list view serving as your home screen to track and manage all transcription files.
- **Interactive Timestamps**: Double-click a project to open its detailed view. Subtitles are listed with timestamps. Clicking any timestamp automatically seeks the media player to that exact moment.
- **DeepL Integration**: Seamlessly translate entire transcriptions or click specific subtitle segments to translate them individually using the DeepL API.

## Tech Stack

- **Core**: Electron, TypeScript, Node.js
- **Frontend**: React, Vite, Tailwind CSS
- **APIs**: OpenAI Whisper API, DeepL API

## Getting Started

### Prerequisites

Ensure you have Node.js and npm installed on your system. You will also need API keys for Whisper and DeepL.

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/724724/whisper-app.git](https://github.com/724724/whisper-app.git)
   cd whisper-app
   npm install
2. Development:
    ```bash
    npm run dev
3. Build:
    ```bash
    # For windows
    $ npm run build:win

    # For macOS
    $ npm run build:mac

    # For Linux
    $ npm run build:linux
    ```