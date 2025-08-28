# StoryMaker AI Backend

## Setup Instructions

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=storymaker_db

# JWT Configuration
JWT_SECRET=your_jwt_secret_here

# Murf.ai Configuration (for text-to-speech)
MURF_API_KEY=your_murf_api_key_here

# Server Configuration
PORT=5000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables in `.env`

3. Initialize the database:
```bash
npm run init-db
```

4. Start the development server:
```bash
npm run dev
```

### Memory Optimization

The server has been configured with memory optimization to prevent heap out of memory errors:

- Node.js heap size increased to 4GB
- Body parser limits increased to 50MB
- V8 memory flags configured

### API Endpoints

- `POST /api/media/fetch-stock-media` - Generate AI images using OpenAI DALL-E with smart allocation
- `GET /api/media/health` - Health check endpoint

### Smart Image Allocation System

The media route now features an intelligent image allocation system that automatically adjusts based on paragraph count:

#### **Short Content (≤100 paragraphs)**
- **Sequential Strategy**: Generates 1 image per paragraph
- **Example**: 15 paragraphs = 15 images, 50 paragraphs = 50 images
- **Approach**: Creates images for each transcript segment sequentially

#### **Long Content (>100 paragraphs)**
- **Strategic Strategy**: Caps at maximum 100 images
- **Example**: 200 paragraphs = 100 images (not 200)
- **Approach**: Uses OpenAI GPT-4 to analyze the entire transcript and create a strategic plan

#### **Strategic Planning for Long Content**
When content exceeds 100 paragraphs, the system:

1. **Analyzes the entire transcript** using GPT-4
2. **Creates exactly 100 image prompts** that best represent the story
3. **Distributes images strategically** across the content
4. **Focuses on key moments** and scene transitions
5. **Provides paragraph numbers** for when each image should appear

#### **Benefits**
- **Storytelling Focus**: Each paragraph gets its own visual representation
- **Cost Effective**: Prevents excessive image generation for long content
- **Storytelling Quality**: Strategic distribution creates better visual flow
- **Intelligent Analysis**: AI determines the most important moments to illustrate
- **Flexible**: Automatically adapts strategy based on paragraph count

### OpenAI Integration

The system uses two OpenAI models:

- **DALL-E 3**: Generates high-quality 1024x1024 images
- **GPT-4**: Analyzes long videos and creates strategic image plans

Each generated image includes:
- High-resolution output (1024x1024)
- Cinematic styling for storytelling
- Strategic timing information
- Priority levels for editing workflow
