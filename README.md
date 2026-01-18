# Prologue.run

**Street View for Marathons.**

Prologue.run is an interactive web platform that allows runners to "scout" race courses before race day. Using 360° panoramic imagery captured from a runner's perspective, users can virtually experience the route, study elevation changes, and plan their race strategy with confidence.

**[Live Demo](https://prologue.run) | [Report Bug**](https://github.com/ayip001/prologue.run/issues)

## ✨ Features

* **🏃‍♂️ Runner's Eye View:** Interactive 360° street-level imagery captured specifically for runners.
* **🗺️ Full Route Coverage:** Complete documentation of marathon courses from start to finish.
* **⛰️ Elevation & Metrics:** Synchronized elevation profiles and distance markers to help plan pacing strategies.
* **🔒 Privacy First:** Automated AI-driven blurring of faces and license plates in all imagery.
* **🌍 Internationalization:** Full support for English and Traditional Chinese (Hong Kong).

## 🛠 Tech Stack

### Web Application (Frontend & API)

* **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
* **Language:** TypeScript
* **3D Rendering:** [Three.js](https://threejs.org/) with [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/) (Radix Primitives)
* **Database:** PostgreSQL (via [Neon.tech](https://neon.tech/))
* **Internationalization:** `next-intl`

### Race Processor (Data Pipeline)

* **Language:** Python 3.11+
* **Computer Vision:** [OpenCV](https://opencv.org/) & [YOLOv8](https://github.com/ultralytics/ultralytics) (for privacy masking)
* **Storage:** Cloudflare R2 (Object Storage)
* **CLI:** Click

## 🚀 Getting Started

The project is divided into two main components: the **Next.js Web App** (`/`) and the **Race Processor** (`/race-processor`).

### Prerequisites

* Node.js 18+
* Python 3.11+ (for processing routes)
* PostgreSQL database
* Cloudflare R2 bucket (or S3-compatible storage)

### 1. Web Application Setup

1. **Clone the repository:**
```bash
git clone https://github.com/ayip001/prologue.run.git
cd prologue.run

```


2. **Install dependencies:**
```bash
npm install

```


3. **Environment Variables:**
Copy `.env.example` to `.env.local` and fill in your credentials.
```bash
cp .env.example .env.local

```


* `DATABASE_URL`: Connection string for your PostgreSQL database.
* `R2_*`: Credentials for your Cloudflare R2 bucket (for image hosting).
* `CDN_BASE_URL`: Public URL for accessing your R2 bucket.


4. **Initialize Database:**
Run the migration script to set up the schema.
```bash
npm run db:migrate

```


5. **Run Development Server:**
```bash
npm run dev

```


Open [http://localhost:3000](https://www.google.com/search?q=http://localhost:3000) with your browser to see the result.

### 2. Processing Race Routes

The `race-processor` is a powerful CLI tool designed to ingest raw 360° footage, sanitize it for privacy, and prepare it for the web.

1. **Navigate to the processor directory:**
```bash
cd race-processor

```


2. **Install Python dependencies:**
```bash
pip install -e .

```


3. **Download AI Models:**
You will need to download the required YOLO models (`yolov8n.pt`, `yolov8n-face.pt`, etc.) into `race-processor/models/`. See the [Processor Documentation](https://www.google.com/search?q=race-processor/USAGE.md) for links.
4. **Process a Route:**
```bash
race-processor process -i /path/to/raw/images -r my-race-slug

```



> 📖 **Full Documentation:** For detailed instructions on using the CLI, blurring options, and GPS overrides, please refer to [race-processor/USAGE.md](https://www.google.com/search?q=race-processor/USAGE.md).

## 📂 Project Structure

```
prologue.run/
├── messages/               # i18n translation files (en, zh-hk)
├── race-processor/         # Python CLI for image processing
│   ├── src/                # Processor source code
│   └── USAGE.md            # Processor manual
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/
│   │   ├── landing/        # Marketing page components
│   │   ├── viewer/         # 360° WebGL player components
│   │   └── shared/         # Common UI components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Database and utility functions
├── db/                     # SQL schemas and migration scripts
└── public/                 # Static assets

```

## 🤝 Contributing

Contributions are welcome! Whether it's submitting a new race route you've recorded, fixing a bug, or translating the app into a new language.

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## 📄 License

This project is licensed under the **GNU General Public License v2.0**. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
