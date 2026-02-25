# Whisper App (WIP)

An application, built with Electron and TypeScript, that streamlines the transcription and translation of audio and video files.

## Features

- **Project Dashboard**: A clean list view serving as your home screen to track and manage all transcription files.
- **Interactive Timestamps**: Double-click a project to open its detailed view. Subtitles are listed with timestamps. Clicking any timestamp automatically seeks the media player to that exact moment.
- **DeepL Integration**: Seamlessly translate entire transcriptions or click specific subtitle segments to translate them individually using the DeepL API.

## Tech Stack

- **Core**: Electron, TypeScript, Node.js
- **Frontend**: React, Vite, Material UI
- **APIs**: OpenAI Whisper API, DeepL API

## Getting Started

### Prerequisites

Ensure you have Node.js and npm installed on your system. You will also need API keys for Whisper and DeepL.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/724724/whisper-app.git
   cd whisper-app
   npm install
   ```
2. Development:
   ```bash
   npm run dev
   ```
3. Build:

   ```bash
   # For windows
   $ npm run build:win

   # For macOS
   $ npm run build:mac

   # For Linux
   $ npm run build:linux
   ```

## Tested Environment

| | Version
| - | -
| OS | Arch Linux x86_64
| Window Manager | Hyprland 0.53.3 (Wayland)
| HW | ThinkPad T1g Gen 8
| GPU | NVIDIA GeForce RTX 5060 Max-Q / Mobile