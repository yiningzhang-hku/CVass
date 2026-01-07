/**
 * CVassit Backend Service
 * 提供简历解析和表单填充映射的 API 服务
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { parseResume } = require('./services/resumeParser');
const { generateFillMapping } = require('./services/mappingGenerator');

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // 支持大文件 base64
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/parse-resume
 * 解析简历文件，返回结构化 profile
 */
app.post('/api/parse-resume', async (req, res) => {
  try {
    const { mode, provider, apiKey, model, fileName, fileContentBase64 } = req.body;

    // 参数校验
    if (!mode || !fileName || !fileContentBase64) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: mode, fileName, fileContentBase64'
      });
    }

    if (mode === 'free') {
      if (!provider || !apiKey || !model) {
        return res.status(400).json({
          success: false,
          error: 'Free 模式需要提供: provider, apiKey, model'
        });
      }
    }

    console.log(`[Parse Resume] mode=${mode}, fileName=${fileName}, size=${fileContentBase64.length} bytes`);

    // 调用解析服务
    const profile = await parseResume({
      mode,
      provider: mode === 'free' ? provider : 'siliconflow',
      apiKey: mode === 'free' ? apiKey : process.env.PRO_SILICONFLOW_API_KEY,
      model: mode === 'free' ? model : process.env.PRO_SILICONFLOW_MODEL || 'Qwen/Qwen2.5-72B-Instruct',
      fileName,
      fileContentBase64
    });

    res.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('[Parse Resume Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || '解析失败'
    });
  }
});

/**
 * POST /api/fill-mapping
 * 根据 profile 和字段列表生成填充映射
 */
app.post('/api/fill-mapping', async (req, res) => {
  try {
    const { mode, provider, apiKey, model, profile, fields } = req.body;

    // 参数校验
    if (!mode || !profile || !fields || !Array.isArray(fields)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: mode, profile, fields'
      });
    }

    if (mode === 'free') {
      if (!provider || !apiKey || !model) {
        return res.status(400).json({
          success: false,
          error: 'Free 模式需要提供: provider, apiKey, model'
        });
      }
    }

    console.log(`[Fill Mapping] mode=${mode}, fields=${fields.length}`);

    // 调用映射生成服务
    const mapping = await generateFillMapping({
      mode,
      provider: mode === 'free' ? provider : 'siliconflow',
      apiKey: mode === 'free' ? apiKey : process.env.PRO_SILICONFLOW_API_KEY,
      model: mode === 'free' ? model : process.env.PRO_SILICONFLOW_MODEL || 'Qwen/Qwen2.5-72B-Instruct',
      profile,
      fields
    });

    res.json({
      success: true,
      mapping
    });

  } catch (error) {
    console.error('[Fill Mapping Error]', error);
    res.status(500).json({
      success: false,
      error: error.message || '生成映射失败'
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 CVassit Backend Server running on http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Mode: ${process.env.PRO_SILICONFLOW_API_KEY ? 'Pro mode configured' : 'Pro mode not configured (set PRO_SILICONFLOW_API_KEY)'}`);
});
