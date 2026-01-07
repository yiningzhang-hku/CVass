/**
 * 简历解析服务
 * 负责从 PDF/Word 文件提取文本并调用 LLM 解析为结构化数据
 */

const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const { callChatCompletion } = require('./llmProvider');

/**
 * 解析简历文件
 * @param {Object} options - 解析选项
 * @param {string} options.mode - 'free' | 'pro'
 * @param {string} options.provider - provider 名称（free 模式）
 * @param {string} options.apiKey - API Key
 * @param {string} options.model - 模型名称
 * @param {string} options.fileName - 文件名
 * @param {string} options.fileContentBase64 - Base64 编码的文件内容
 * @returns {Promise<Object>} 解析后的 profile 对象
 */
async function parseResume(options) {
  const { mode, provider, apiKey, model, fileName, fileContentBase64 } = options;

  // 1. 解码 base64
  const fileBuffer = Buffer.from(fileContentBase64, 'base64');
  console.log(`[Resume Parser] Decoded file size: ${fileBuffer.length} bytes`);

  // 2. 根据文件类型提取文本
  let extractedText = '';
  const fileNameLower = fileName.toLowerCase();

  if (fileNameLower.endsWith('.pdf')) {
    extractedText = await extractTextFromPDF(fileBuffer);
  } else if (fileNameLower.endsWith('.docx')) {
    extractedText = await extractTextFromWord(fileBuffer);
  } else if (fileNameLower.endsWith('.doc')) {
    throw new Error('不支持旧版 .doc 格式，请将文件另存为 .docx 或 PDF 格式');
  } else {
    throw new Error('不支持的文件格式，仅支持 PDF 和 Word (.docx)');
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error('未能从文件中提取到文本内容，请检查文件是否为空或损坏');
  }

  console.log(`[Resume Parser] Extracted text length: ${extractedText.length} characters`);

  // 3. 调用 LLM 解析文本
  const profile = await callAIParseAPI(extractedText, fileName, {
    mode,
    provider,
    apiKey,
    model
  });

  // 4. 规范化数据
  return normalizeToProfile(profile);
}

/**
 * 从 PDF 文件提取文本
 */
async function extractTextFromPDF(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text.trim();
  } catch (error) {
    throw new Error(`PDF 解析失败: ${error.message}`);
  }
}

/**
 * 从 Word 文件提取文本
 */
async function extractTextFromWord(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    if (result.messages && result.messages.length > 0) {
      console.warn('[Word Parser] Warnings:', result.messages);
    }
    return result.value.trim();
  } catch (error) {
    throw new Error(`Word 解析失败: ${error.message}`);
  }
}

/**
 * 调用 AI API 解析简历文本
 */
async function callAIParseAPI(textContent, fileName, config) {
  const systemPrompt = `你是一个专业的简历解析助手。请从用户提供的简历纯文本中提取完整的结构化信息，并严格按照以下 JSON 格式返回：

{
  "basic": {
    "name": "姓名",
    "gender": "男/女",
    "phone": "手机号",
    "email": "邮箱",
    "birthDate": "出生年月(YYYY.M格式，如2000.5)",
    "ethnicity": "民族",
    "nationality": "国籍",
    "hometown": "户籍所在地",
    "currentAddress": "现居住地",
    "maritalStatus": "婚姻状况",
    "politicalStatus": "政治面貌",
    "height": "身高(数字)",
    "weight": "体重(数字)"
  },
  "education": [
    {
      "degree": "学历",
      "school": "学校名称",
      "startDate": "YYYY.M",
      "endDate": "YYYY.M",
      "college": "院系",
      "major": "专业",
      "gpa": "绩点",
      "scorePercent": "百分制成绩",
      "schoolSystem": "学制",
      "status": "在读/已毕业/应届毕业生",
      "eduType": "全日制/非全日制等",
      "lab": "实验室",
      "advisor": "指导教师",
      "thesisTitle": "毕业论文题目",
      "thesisAdvisor": "论文导师",
      "minorSchool": "辅修院校",
      "minorDegree": "辅修学位",
      "exchangeSchool": "交换院校",
      "exchangeDate": "交换时间",
      "exchangeCourse": "交换课程"
    }
  ],
  "internship": [ { "company": "", "department": "", "position": "", "startDate": "YYYY.M", "endDate": "YYYY.M", "description": "" } ],
  "workExperience": [ { "company": "", "department": "", "position": "", "startDate": "YYYY.M", "endDate": "YYYY.M", "description": "" } ],
  "project": [ { "name": "", "role": "", "startDate": "YYYY.M", "endDate": "YYYY.M", "description": "" } ],
  "award": [ { "type": "", "name": "", "date": "YYYY.M", "description": "" } ],
  "competition": [ { "name": "", "level": "", "award": "", "date": "YYYY.M", "role": "", "description": "" } ],
  "language": [ { "language": "", "score": "" } ],
  "certificate": [ { "name": "", "date": "YYYY.M" } ],
  "familyMembers": [ { "name": "", "relation": "", "phone": "", "company": "", "position": "" } ],
  "campus": {
    "leader": [ { "position": "", "startDate": "YYYY.M", "endDate": "YYYY.M" } ],
    "activity": [ { "name": "", "description": "" } ]
  },
  "socialPractice": {
    "volunteer": [ { "organization": "", "hours": 0, "duty": "" } ],
    "project": [ { "name": "", "role": "", "result": "" } ]
  },
  "professionalAchievement": {
    "paper": [ { "title": "", "journal": "", "date": "YYYY.M", "authorOrder": "", "doi": "" } ],
    "patent": [ { "name": "", "number": "", "type": "", "status": "", "role": "" } ],
    "conference": [ { "name": "", "topic": "", "date": "YYYY.M" } ]
  },
  "skill": { "description": "" },
  "selfEvaluation": { "description": "" },
  "specialNotes": { "description": "" }
}

注意事项：
1. 尽可能提取所有信息，没有的字段留空字符串或空数组
2. 日期统一为 YYYY.M 格式（如 2023.9）
3. 数字字段（height/weight/hours）用数字类型
4. 必须返回严格的 JSON 格式，不要有任何额外文本
5. 如果简历中某些维度完全没有信息，对应的数组返回 []`;

  // 智能文本截断
  const maxTextLength = 12000;
  let truncatedText = textContent;
  
  if (textContent.length > maxTextLength) {
    const frontPart = Math.floor(maxTextLength * 0.7);
    const backPart = maxTextLength - frontPart;
    const frontText = textContent.substring(0, frontPart);
    const backText = textContent.substring(textContent.length - backPart);
    truncatedText = frontText + '\n\n[... 中间部分已省略 ...]\n\n' + backText;
  }

  const userPrompt = `请解析以下简历文件（${fileName}）中的内容，提取所有结构化信息：\n\n${truncatedText}`;

  // 获取实际的 provider 和 model
  const actualProvider = config.provider || 'siliconflow';
  const actualModel = config.model;
  
  // #region agent log
  const fs = require('fs');
  const logPath = 'd:\\projects\\cvassit\\CVass\\CVassitance\\.cursor\\debug.log';
  const logEntry = {
    timestamp: new Date().toISOString(),
    location: 'resumeParser.js:181',
    message: 'callAIParseAPI - provider and model',
    data: { provider: actualProvider, model: actualModel, hasApiKey: !!config.apiKey },
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId: 'A'
  };
  try {
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  } catch (e) {}
  // #endregion

  console.log(`[Resume Parser] Calling LLM with provider=${actualProvider}, model=${actualModel}`);

  // 调用 LLM
  const response = await callChatCompletion({
    provider: actualProvider,
    apiKey: config.apiKey,
    model: actualModel
  }, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], {
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 8192
  });

  // 解析 JSON
  try {
    return JSON.parse(response);
  } catch (e) {
    throw new Error(`AI 返回内容不是有效的 JSON: ${e.message}`);
  }
}

/**
 * 规范化 profile 数据
 */
function normalizeToProfile(data) {
  return {
    basic: data.basic || {},
    education: Array.isArray(data.education) ? data.education : [],
    award: Array.isArray(data.award) ? data.award : [],
    competition: Array.isArray(data.competition) ? data.competition : [],
    project: Array.isArray(data.project) ? data.project : [],
    internship: Array.isArray(data.internship) ? data.internship : [],
    workExperience: Array.isArray(data.workExperience) ? data.workExperience : [],
    language: Array.isArray(data.language) ? data.language : [],
    certificate: Array.isArray(data.certificate) ? data.certificate : [],
    familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : [],
    campus: {
      leader: Array.isArray(data.campus?.leader) ? data.campus.leader : [],
      activity: Array.isArray(data.campus?.activity) ? data.campus.activity : []
    },
    socialPractice: {
      volunteer: Array.isArray(data.socialPractice?.volunteer) ? data.socialPractice.volunteer : [],
      project: Array.isArray(data.socialPractice?.project) ? data.socialPractice.project : []
    },
    professionalAchievement: {
      paper: Array.isArray(data.professionalAchievement?.paper) ? data.professionalAchievement.paper : [],
      patent: Array.isArray(data.professionalAchievement?.patent) ? data.professionalAchievement.patent : [],
      conference: Array.isArray(data.professionalAchievement?.conference) ? data.professionalAchievement.conference : []
    },
    skill: {
      description: data.skill?.description || ''
    },
    selfEvaluation: {
      description: data.selfEvaluation?.description || ''
    },
    specialNotes: {
      description: data.specialNotes?.description || ''
    }
  };
}

module.exports = {
  parseResume
};
