# CVassit Backend Service

简历解析和表单填充映射的后端服务。

## 功能

- **简历解析** (`/api/parse-resume`): 从 PDF/Word 文件提取文本并解析为结构化 profile
- **填充映射生成** (`/api/fill-mapping`): 根据 profile 和表单字段生成填充映射

## 安装

```bash
cd backend
npm install
```

## 配置

1. 复制 `.env.example` 为 `.env`:
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，设置 Pro 模式的 SiliconFlow API Key:
```
PRO_SILICONFLOW_API_KEY=your_siliconflow_api_key_here
PRO_SILICONFLOW_MODEL=Qwen/Qwen2.5-72B-Instruct
```

## 运行

开发模式（自动重启）:
```bash
npm run dev
```

生产模式:
```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 文档

### POST /api/parse-resume

解析简历文件。

**请求体 (Free 模式)**:
```json
{
  "mode": "free",
  "provider": "siliconflow",
  "apiKey": "用户API Key",
  "model": "Qwen/Qwen2.5-32B-Instruct",
  "fileName": "resume.pdf",
  "fileContentBase64": "base64编码的文件内容"
}
```

**请求体 (Pro 模式)**:
```json
{
  "mode": "pro",
  "fileName": "resume.pdf",
  "fileContentBase64": "base64编码的文件内容"
}
```

**响应**:
```json
{
  "success": true,
  "profile": { ... }
}
```

### POST /api/fill-mapping

生成表单填充映射。

**请求体 (Free 模式)**:
```json
{
  "mode": "free",
  "provider": "siliconflow",
  "apiKey": "用户API Key",
  "model": "Qwen/Qwen2.5-32B-Instruct",
  "profile": { ... },
  "fields": [ ... ]
}
```

**请求体 (Pro 模式)**:
```json
{
  "mode": "pro",
  "profile": { ... },
  "fields": [ ... ]
}
```

**响应**:
```json
{
  "success": true,
  "mapping": {
    "field_id": "value",
    ...
  }
}
```

## 支持的 Provider

- `siliconflow`: SiliconFlow (通过 SiliconFlow API，Pro 模式默认使用)
- `deepseek_official`: DeepSeek 官方 API
- `kimi_official`: Kimi 官方 API
- `internal_qwen`: 内部 Qwen (已废弃，仅用于向后兼容)
