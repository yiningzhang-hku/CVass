/**
 * 表单填充映射生成服务
 * 根据 profile 和字段列表生成字段填充映射
 */

const { callChatCompletion } = require('./llmProvider');

/**
 * 生成填充映射
 * @param {Object} options - 生成选项
 * @param {string} options.mode - 'free' | 'pro'
 * @param {string} options.provider - provider 名称（free 模式）
 * @param {string} options.apiKey - API Key
 * @param {string} options.model - 模型名称
 * @param {Object} options.profile - profile 对象
 * @param {Array} options.fields - 字段列表
 * @returns {Promise<Object>} 字段映射对象 { fieldId: value }
 */
async function generateFillMapping(options) {
  const { mode, provider, apiKey, model, profile, fields } = options;

  const systemPrompt = `你是一个精准的网页填表助手。你的核心任务是解决【数据错位】问题、【多段经历匹配】并进行【格式标准化】。

输入：
1. User Resume (JSON): 包含以下维度的数据：
   - basic: 基本信息（name, gender, phone, email, birthDate, ethnicity, nationality, hometown, currentAddress, maritalStatus, politicalStatus, height, weight）
   - education[]: 教育经历数组
   - award[]: 获奖经历数组
   - competition[]: 竞赛经历数组
   - project[]: 项目经历数组
   - internship[]: 实习经历数组
   - workExperience[]: 工作经历数组
   - campus: { leader[], activity[] } 在校经历
   - socialPractice: { volunteer[], project[] } 社会实践
   - professionalAchievement: { paper[], patent[], conference[] } 专业成果
   - language[]: 语言能力数组
   - certificate[]: 专业资格证书数组
   - familyMembers[]: 家庭成员信息数组
   - skill: { description } 技能描述
   - selfEvaluation: { description } 自我评价
   - specialNotes: { description } 特殊说明

2. Web Fields (JSON): 网页字段列表，每个字段包含:
   - id: 字段唯一标识
   - label: 字段标签
   - type: 字段类型
   - context: 上下文类型
   - sectionIndex: 该字段所属的段落索引（0表示第一段）
   - options: 下拉框选项（如果有）

必须严格遵守的【多段经历匹配与反错位规则】：

1. **Context + SectionIndex 双重隔离**:
   - 字段的 'context' 决定数据源类型
   - 字段的 'sectionIndex' 决定使用该类型数据的第几段
   - Context映射：
     * "Education" -> resume.education[sectionIndex]
     * "Work/Internship" -> 优先resume.internship[sectionIndex]，其次resume.workExperience[sectionIndex]
     * "Work Experience" -> resume.workExperience[sectionIndex]
     * "Project" -> resume.project[sectionIndex]
     * "Award" -> resume.award[sectionIndex]
     * "Competition" -> resume.competition[sectionIndex]
     * "Language" -> resume.language[sectionIndex]
     * "Certificate" -> resume.certificate[sectionIndex]
     * "Family" -> resume.familyMembers[sectionIndex]
     * "Campus Leader" -> resume.campus.leader[sectionIndex]
     * "Campus Activity" -> resume.campus.activity[sectionIndex]
     * "Volunteer" -> resume.socialPractice.volunteer[sectionIndex]
     * "Social Project" -> resume.socialPractice.project[sectionIndex]
     * "Paper" -> resume.professionalAchievement.paper[sectionIndex]
     * "Patent" -> resume.professionalAchievement.patent[sectionIndex]
     * "Conference" -> resume.professionalAchievement.conference[sectionIndex]
     * "Basic Info" -> resume.basic (无索引)
     * "Skill" -> resume.skill.description
     * "Self Evaluation" -> resume.selfEvaluation.description
     * "Special Notes" -> resume.specialNotes.description

2. **数据数组边界检查**:
   - 如果 sectionIndex 超出数据数组长度，返回 null

3. **时间格式标准化**:
   - 统一转为 "YYYY.M" (如 "2025.8")
   - 单独月份输入框：去除前导零 ("02" -> "2")
   - 单独年份输入框：保留完整年份

4. **下拉框智能匹配**:
   - 优先完全匹配 value 或 text
   - 次选包含匹配
   - 无匹配时返回 null

5. **空值处理**:
   - 数据不存在或为空时返回 null

返回格式：{ "field_id": "value" 或 null }`;

  const userPrompt = JSON.stringify({
    user_resume: profile,
    web_fields: fields
  });

  // 调用 LLM
  const response = await callChatCompletion({
    provider: provider || 'siliconflow',
    apiKey: apiKey,
    model: model
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

module.exports = {
  generateFillMapping
};
