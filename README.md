# 🤖 LLM Agent POC

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/PythonicVarun/LLM-Agent-POC)
[![GitHub issues](https://img.shields.io/github/issues/PythonicVarun/LLM-Agent-POC)](https://github.com/PythonicVarun/LLM-Agent-POC/issues)
[![GitHub forks](https://img.shields.io/github/forks/PythonicVarun/LLM-Agent-POC)](https://github.com/PythonicVarun/LLM-Agent-POC/network)
[![GitHub stars](https://img.shields.io/github/stars/PythonicVarun/LLM-Agent-POC)](https://github.com/PythonicVarun/LLM-Agent-POC/stargazers)

A smart LLM agent for various tasks, deployed as a Cloudflare Workers Site. This project serves a static website from the `static/` directory.

## 📜 Table of Contents

- [LLM Agent POC](#-llm-agent-poc)
    - [Table of Contents](#-table-of-contents)
    - [About The Project](#-about-the-project)
    - [Key Features](#-key-features)
    - [Getting Started](#-getting-started)
        - [Prerequisites](#-prerequisites)
        - [Installation](#-installation)
    - [Available Scripts](#-available-scripts)
    - [Deployment](#-deployment)
    - [Contributing](#-contributing)
    - [License](#-license)
    - [Contact](#-contact)

## 🧐 About The Project

This project is a proof-of-concept for a smart LLM agent. It is built as a Cloudflare Workers Site, which means it's a serverless application that serves a static website. The core logic is in `src/index.ts`, which uses `@cloudflare/kv-asset-handler` to serve static assets.

## ✨ Key Features

- **☁️ Serverless:** Runs on Cloudflare Workers, a serverless platform.
- **📄 Static Site:** Serves a static website from the `static/` directory.
- **📦 Asset Handling:** Uses `@cloudflare/kv-asset-handler` to efficiently serve assets.
- **💻 Development Server:** Comes with a local development server powered by Wrangler.
- **🚀 Deployment Scripts:** Includes scripts for easy deployment to Cloudflare.

## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### ✅ Prerequisites

- **Node.js:** Make sure you have Node.js installed. You can download it from [nodejs.org](https://nodejs.org/).
- **npm:** npm is the package manager for Node.js and comes with the Node.js installation.
- **Wrangler:** This project uses Wrangler, the command-line tool for Cloudflare Workers. You should authenticate it if you haven't already:
    ```sh
    npx wrangler login
    ```

### 📦 Installation

1.  **Clone the repo:**
    ```sh
    git clone https://github.com/PythonicVarun/LLM-Agent-POC.git
    ```
2.  **Navigate to the project directory:**
    ```sh
    cd LLM-Agent-POC
    ```
3.  **Install NPM packages:**
    ```sh
    npm install
    ```

## 💻 Available Scripts

In the project directory, you can run the following scripts:

- `npm run prettify`: Formats the code using Prettier.
- `npm start`: Starts the local development server.
- `npm run predeploy`: Minifies the static assets before deployment.
- `npm run deploy`: Deploys the project to Cloudflare Workers.
- `npm run restore:static`: Restores the static assets after deployment.
- `npm run install:deps`: Installs the project dependencies.
- `npm run publish`: Publishes the site using Wrangler.
- `npm test`: Runs the test suite.

## 🚀 Deployment

To deploy the project to Cloudflare Workers, simply run the following command:

```sh
npm run deploy
```

This will first minify the static assets and then deploy the project using Wrangler.

## 🙏 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📫 Contact

Varun Agnihotri - [@PythonicVarun](https://twitter.com/@PythonicVarun) - code@pythonicvarun.me
