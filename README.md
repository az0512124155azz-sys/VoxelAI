# VoxelAI Studio

<div align="center">
  <img src="assets/banner.png" alt="VoxelAI Studio" width="800" />
  
  **AI-powered 3D modeling studio — runs locally on your computer**
  
  ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
  ![License](https://img.shields.io/badge/license-MIT-green)
  ![Version](https://img.shields.io/badge/version-1.0.0-purple)
</div>

---

## ✨ Features

### 🎨 3D Generation Modes
| Mode | Description |
|---|---|
| **Single Image → 3D** | Upload 1 photo, get a full 3D model |
| **Multi-Image → 3D** | Upload multiple angles for better reconstruction |
| **Image + Text → 3D** | Guide the AI with descriptive text |
| **Multi-Image + Text** | Best quality: multiple photos + text prompt |
| **Text Only → 3D** | Pure text prompt to 3D object |

### 🛠️ 3D Model Editing
- Upload any 3D file and describe changes in natural language
- Edit geometry, texture, style, deformation, color
- Adjustable AI strength slider

### 🔀 3D Model Blending
- Upload two 3D models + optional text prompt
- Blend geometry, texture, style with adjustable ratio
- Merge features from both models into one

### 👤 3D Caricature & Avatar Studio
- Upload a photo of yourself or your pet
- Choose from 8 styles: Pixar/Disney, Anime, Low-Poly, Claymation, Cyberpunk, Chibi, Realistic, Toon
- Perfect for printing your own 3D figure!

### 🖨️ Smart 3D Print Splitter
- Select print bed size (Small 150mm / Medium 220mm / Standard 256mm / Large 300mm / XL 450mm / Custom)
- **Smart fit check**: if model fits → no cutting, no pins!
- **Minimum cuts algorithm**: splits into fewest pieces possible
- **Auto alignment pins**: snap-fit connectors for glueless assembly
- **Slicer recommendations**: layer height, infill %, supports, orientation tips

### 📦 Export Formats (15+)
| Category | Formats |
|---|---|
| **3D Printing** | `.STL` (Binary & ASCII), `.3MF`, `.OBJ`, `.PLY` |
| **Animation/Games** | `.GLB`, `.GLTF`, `.FBX`, `.DAE` (Collada), `.USDZ` |
| **CAD/Legacy** | `.OFF`, `.WRL` (VRML), `.DXF`, `.XYZ` (Point Cloud), `.STEP` |

---

## 🚀 Installation

### Windows
Download the `.exe` installer from [Releases](../../releases/latest).

### macOS
Download the `.dmg` from [Releases](../../releases/latest).  
Intel: `x64` | Apple Silicon: `arm64`

### Linux
Download the `.AppImage` or `.deb` package from [Releases](../../releases/latest).

---

## 🔧 Local AI Engine Setup (Optional)

VoxelAI Studio works offline with placeholder models out of the box.  
For **real AI generation**, connect one of these local engines:

| Engine | Port | Install |
|---|---|---|
| [Shap-E](https://github.com/openai/shap-e) | `5000` | `pip install shap-e` |
| [InstantMesh](https://github.com/TencentARC/InstantMesh) | `7860` | Gradio interface |
| [Tripo3D Local](https://www.tripo3d.ai) | `8080` | Desktop app |

Once running, VoxelAI Studio will automatically detect and connect to the AI engine.

---

## 🏗️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for current platform
npm run dist

# Build for all platforms
npm run build:all
```

---

## 📋 System Requirements

| Component | Minimum | Recommended |
|---|---|---|
| OS | Windows 10, macOS 12, Ubuntu 20.04 | Windows 11, macOS 14, Ubuntu 22.04 |
| RAM | 4 GB | 8 GB+ |
| GPU | Any (for viewer) | NVIDIA RTX (for local AI) |
| Storage | 500 MB | 2 GB+ (with AI models) |

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

<div align="center">Made with ❤️ for the 3D printing and AI community</div>
