/**
 * LLM Provider 适配层
 * 统一封装不同 LLM 平台的调用接口
 */

const fetch = require('node-fetch');

/**
 * Provider 配置接口
 * @typedef {Object} ProviderConfig
 * @property {"siliconflow"|"deepseek_official"|"qwen_official"|"kimi_official"|"internal_qwen"} provider - Provider 名称
 * @property {string} apiKey - API Key
 * @property {string} model - 模型名称
 */

/**
 * 调用 Chat Completion API
 * @param {ProviderConfig} config - Provider 配置
 * @param {Array<{role: string, content: string}>} messages - 消息列表
 * @param {Object} options - 额外选项（temperature, max_tokens, response_format 等）
 * @returns {Promise<string>} 返回 content 字符串
 */
async function callChatCompletion(config, messages, options = {}) {
  const { provider, apiKey, model } = config;

  if (!apiKey) {
    throw new Error(`Provider ${provider} 需要 API Key`);
  }

  // 根据 provider 选择对应的 API 端点
  const endpoint = getProviderEndpoint(provider);
  const headers = getProviderHeaders(provider, apiKey);
  const body = buildRequestBody(provider, model, messages, options);

  console.log(`[LLM Provider] Calling ${provider} API, model: ${model}`);
  console.log(`[LLM Provider] Endpoint: ${endpoint}`);
  console.log(`[LLM Provider] Request body model field: ${body.model}`);

  // #region agent log
  const fs = require('fs');
  const logPath = 'd:\\projects\\cvassit\\CVass\\CVassitance\\.cursor\\debug.log';
  const logEntry = {
    timestamp: new Date().toISOString(),
    location: 'llmProvider.js:37',
    message: 'before fetch - provider, model, endpoint',
    data: { provider, model, endpoint, requestBodyModel: body.model },
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId: 'B'
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (e) {}
  // #endregion

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      timeout: 180000 // 180秒超时
    });

    // #region agent log
    const logEntry2 = {
      timestamp: new Date().toISOString(),
      location: 'llmProvider.js:55',
      message: 'after fetch - response status',
      data: { status: response.status, ok: response.ok, provider, model },
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'B'
    };
    try {
      fs.appendFileSync(logPath, JSON.stringify(logEntry2) + '\n');
    } catch (e) {}
    // #endregion

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      
      // #region agent log
      const logEntry3 = {
        timestamp: new Date().toISOString(),
        location: 'llmProvider.js:65',
        message: 'API error response',
        data: { status: response.status, errorText: errorText.substring(0, 500), errorData, provider, model },
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C'
      };
      try {
        fs.appendFileSync(logPath, JSON.stringify(logEntry3) + '\n');
      } catch (e) {}
      // #endregion
      
      // 处理模型不存在的错误，提供更友好的提示
      if (errorData.error && (errorData.error.message === 'Model Not Exist' || errorData.error.code === 'invalid_request_error')) {
        let helpfulMessage = `模型 "${model}" 不存在或不可用`;
        if (provider === 'siliconflow') {
          helpfulMessage += `\n\n提示：SiliconFlow 支持的模型格式为 Qwen/Qwen2.5-72B-Instruct 或 deepseek-ai/DeepSeek-V3`;
        } else if (provider === 'deepseek_official') {
          helpfulMessage += `\n\n提示：DeepSeek 官方支持的模型为 deepseek-chat 或 deepseek-reasoner`;
        } else if (provider === 'qwen_official' || provider === 'internal_qwen') {
          helpfulMessage += `\n\n提示：通义千问官方支持的模型为 qwen-plus、qwen-turbo 或 qwen-max`;
        } else if (provider === 'kimi_official') {
          helpfulMessage += `\n\n提示：Kimi 官方支持的模型为 kimi-k2-0905-preview、kimi-k2-turbo-preview、kimi-k2-thinking 或 kimi-k2-thinking-turbo`;
        }
        helpfulMessage += `\n\n请检查：\n1. 您选择的 Provider 是否正确\n2. 模型名称是否与 Provider 匹配\n3. 如果使用免费模式，请到「⚙️ 设置」页面检查模型配置`;
        throw new Error(helpfulMessage);
      }
      
      // 其他错误
      const errorMessage = errorData.error?.message || errorData.error || errorText;
      throw new Error(`API 调用失败 (HTTP ${response.status}): ${errorMessage}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`API 错误: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Qwen 官方 API 的响应格式不同
    if (provider === 'qwen_official' || provider === 'internal_qwen') {
      if (data.output && data.output.choices && data.output.choices[0]) {
        return data.output.choices[0].message.content;
      }
      if (data.output && data.output.text) {
        return data.output.text;
      }
      throw new Error('Qwen API 返回格式异常');
    }

    // 其他 Provider 使用标准 OpenAI 格式
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API 返回格式异常，无法获取解析结果');
    }

    return data.choices[0].message.content;

  } catch (error) {
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new Error(`请求超时: ${error.message}`);
    }
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`网络请求失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 获取 Provider 的 API 端点
 */
function getProviderEndpoint(provider) {
  const endpoints = {
    'siliconflow': 'https://api.siliconflow.cn/v1/chat/completions',
    'deepseek_official': 'https://api.deepseek.com/v1/chat/completions',  // 修复：添加 /chat/completions
    'qwen_official': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    'kimi_official': 'https://api.moonshot.ai/v1/chat/completions',  // 修复：添加 /chat/completions
    'internal_qwen': 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
  };

  const endpoint = endpoints[provider];
  if (!endpoint) {
    throw new Error(`不支持的 Provider: ${provider}`);
  }
  return endpoint;
}

/**
 * 获取 Provider 的请求头
 */
function getProviderHeaders(provider, apiKey) {
  const baseHeaders = {
    'Content-Type': 'application/json'
  };

  switch (provider) {
    case 'siliconflow':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`
      };

    case 'deepseek_official':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`
      };

    case 'qwen_official':
    case 'internal_qwen':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-SSE': 'disable'
      };

    case 'kimi_official':
      return {
        ...baseHeaders,
        'Authorization': `Bearer ${apiKey}`
      };

    default:
      throw new Error(`不支持的 Provider: ${provider}`);
  }
}

/**
 * 验证并规范化模型名称
 * 根据 provider 验证模型名称格式，如果不匹配则尝试映射或抛出错误
 */
function normalizeModelName(provider, model) {
  if (!model) {
    throw new Error(`模型名称不能为空`);
  }

  // SiliconFlow: 使用 Qwen/xxx 格式
  if (provider === 'siliconflow') {
    // SiliconFlow 支持 Qwen/xxx 格式
    if (model.startsWith('Qwen/') || model.startsWith('deepseek-ai/')) {
      return model;
    }
    // 如果用户输入的是简单名称，尝试添加前缀
    if (model.includes('Qwen') || model.includes('DeepSeek')) {
      // 已经是完整格式
      return model;
    }
    // 否则保持原样，让 API 决定
    return model;
  }

  // DeepSeek 官方: 使用 deepseek-chat, deepseek-reasoner 等格式
  if (provider === 'deepseek_official') {
    // 如果用户输入的是 SiliconFlow 格式，尝试转换
    if (model.startsWith('deepseek-ai/')) {
      // 移除 deepseek-ai/ 前缀
      return model.replace('deepseek-ai/', 'deepseek-');
    }
    if (model.startsWith('Qwen/')) {
      throw new Error(`DeepSeek 官方不支持 Qwen 模型，请使用 deepseek-chat 或 deepseek-reasoner`);
    }
    // 如果已经是 deepseek-chat 或 deepseek-reasoner 格式，直接返回
    if (model.startsWith('deepseek-')) {
      return model;
    }
    // 默认使用 deepseek-chat
    console.warn(`[LLM Provider] DeepSeek 官方模型名称 "${model}" 可能不正确，建议使用 deepseek-chat 或 deepseek-reasoner`);
    return model;
  }

  // Qwen 官方: 使用 qwen-plus, qwen-turbo, qwen-max 等格式
  if (provider === 'qwen_official' || provider === 'internal_qwen') {
    // 如果用户输入的是 SiliconFlow 格式，尝试转换
    if (model.startsWith('Qwen/')) {
      // 尝试映射常见的 Qwen 模型
      const modelMap = {
        'Qwen/Qwen2.5-72B-Instruct': 'qwen-plus',
        'Qwen/Qwen2.5-32B-Instruct': 'qwen-plus',
        'Qwen/Qwen2.5-14B-Instruct': 'qwen-turbo',
        'Qwen/Qwen2.5-7B-Instruct': 'qwen-turbo',
        'Qwen/Qwen2-72B-Instruct': 'qwen-plus',
        'Qwen/Qwen2-32B-Instruct': 'qwen-turbo',
        'Qwen/Qwen2-14B-Instruct': 'qwen-turbo',
        'Qwen/Qwen2-7B-Instruct': 'qwen-turbo'
      };
      if (modelMap[model]) {
        console.log(`[LLM Provider] 将模型名称 "${model}" 映射为 Qwen 官方格式 "${modelMap[model]}"`);
        return modelMap[model];
      }
      throw new Error(`Qwen 官方不支持模型 "${model}"，请使用 qwen-plus、qwen-turbo 或 qwen-max`);
    }
    // 如果已经是 qwen-xxx 格式，直接返回
    if (model.startsWith('qwen-')) {
      return model;
    }
    // 默认使用 qwen-plus
    console.warn(`[LLM Provider] Qwen 官方模型名称 "${model}" 可能不正确，建议使用 qwen-plus、qwen-turbo 或 qwen-max`);
    return model;
  }

  // Kimi 官方: 使用 kimi-k2-0905-preview, kimi-k2-turbo-preview 等格式
  if (provider === 'kimi_official') {
    // 拒绝明显不属于 Kimi 的模型格式
    if (model.startsWith('Qwen/') || model.startsWith('deepseek-ai/')) {
      throw new Error(`Kimi 官方不支持模型 "${model}"，请使用 kimi-k2-0905-preview、kimi-k2-turbo-preview、kimi-k2-thinking 或 kimi-k2-thinking-turbo`);
    }
    // 优先支持新的 kimi-k2-* 格式（官方推荐）
    if (model.startsWith('kimi-k2-')) {
      return model;
    }
    // 兼容旧的 moonshot-* 格式（向后兼容）
    if (model.startsWith('moonshot-')) {
      console.warn(`[LLM Provider] Kimi 官方模型名称 "${model}" 为旧格式，建议使用新的 kimi-k2-* 格式（如 kimi-k2-turbo-preview）`);
      return model;
    }
    // 其他格式给出提示
    console.warn(`[LLM Provider] Kimi 官方模型名称 "${model}" 可能不正确，建议使用 kimi-k2-0905-preview、kimi-k2-turbo-preview、kimi-k2-thinking 或 kimi-k2-thinking-turbo`);
    return model;
  }

  // 未知 provider，直接返回原模型名称
  return model;
}

/**
 * 构建请求体
 */
function buildRequestBody(provider, model, messages, options) {
  // 验证并规范化模型名称
  const normalizedModel = normalizeModelName(provider, model);
  
  // #region agent log
  const fs = require('fs');
  const logPath = 'd:\\projects\\cvassit\\CVass\\CVassitance\\.cursor\\debug.log';
  const logEntry = {
    timestamp: new Date().toISOString(),
    location: 'llmProvider.js:230',
    message: 'buildRequestBody - model normalization',
    data: { provider, originalModel: model, normalizedModel },
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId: 'D'
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (e) {}
  // #endregion

  // Qwen 官方 API 的格式略有不同
  if (provider === 'qwen_official' || provider === 'internal_qwen') {
    return {
      model: normalizedModel,
      input: {
        messages: messages
      },
      parameters: {
        temperature: options.temperature || 0.1,
        max_tokens: options.max_tokens || 8192,
        result_format: options.response_format?.type === 'json_object' ? 'message' : 'text'
      }
    };
  }

  // 其他 Provider 使用标准 OpenAI 格式
  return {
    model: normalizedModel,
    messages: messages,
    temperature: options.temperature || 0.1,
    max_tokens: options.max_tokens || 8192,
    ...(options.response_format && { response_format: options.response_format })
  };
}

module.exports = {
  callChatCompletion
};
