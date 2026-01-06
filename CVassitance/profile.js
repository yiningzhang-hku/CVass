/* START OF FILE profile.js */

/**
 * 简历解析模块
 * 职责：动态加载库 → 提取纯文本 → 调用 AI API 解析 → 规范化为 profile 对象
 * 支持格式：PDF、Word (.docx)
 * 特性：多 CDN 自动切换，故障转移机制
 */

// ========== 库文件配置（优先使用本地文件，符合 Manifest V3 CSP 要求）==========
const CDN_CONFIGS = {
    pdfjs: [
        // 优先使用本地文件（Manifest V3 要求）
        {
            main: chrome.runtime.getURL('libs/pdf.min.js'),
            worker: chrome.runtime.getURL('libs/pdf.worker.min.js')
        },
        // 备用：CDN（在 popup 中会被 CSP 阻止，但保留用于其他环境）
        {
            main: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
            worker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
        },
        {
            main: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
            worker: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
        },
        {
            main: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        },
        {
            main: 'https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/build/pdf.min.js',
            worker: 'https://registry.npmmirror.com/pdfjs-dist/3.11.174/files/build/pdf.worker.min.js'
        },
        {
            main: 'https://cdn.bootcdn.net/ajax/libs/pdf.js/3.11.174/pdf.min.js',
            worker: 'https://cdn.bootcdn.net/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
        }
    ],
    mammoth: [
        // 优先使用本地文件（Manifest V3 要求）
        chrome.runtime.getURL('libs/mammoth.browser.min.js'),
        // 备用：CDN（在 popup 中会被 CSP 阻止，但保留用于其他环境）
        'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',
        'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
        'https://registry.npmmirror.com/mammoth/1.6.0/files/mammoth.browser.min.js',
        'https://cdn.bootcdn.net/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    ]
};

// 库加载状态缓存
const libraryStatus = {
    pdfjs: { loaded: false, loading: false },
    mammoth: { loaded: false, loading: false }
};

/**
 * 动态加载 JS 库（支持多 CDN 自动切换）
 * @param {string[]} urls - CDN URL 列表
 * @param {string} libName - 库名称（用于日志）
 * @param {string} checkVar - 全局变量名（用于检查是否加载成功）
 * @returns {Promise<void>}
 */
async function loadLibraryWithFallback(urls, libName, checkVar) {
    console.log(`📦 profile.js: 开始加载 ${libName}，共 ${urls.length} 个 CDN 备选`);
    
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(`🔄 profile.js: 尝试从 CDN ${i + 1}/${urls.length} 加载 ${libName}:`, url.substring(0, 60) + '...');
        
        try {
            await loadScript(url, 10000); // 10秒超时
            
            // 检查是否真的加载成功
            if (typeof window[checkVar] !== 'undefined') {
                console.log(`✅ profile.js: ${libName} 加载成功（CDN ${i + 1}）`);
                return;
            } else {
                console.warn(`⚠️ profile.js: ${libName} 脚本加载但变量未定义，尝试下一个 CDN`);
            }
        } catch (error) {
            console.warn(`❌ profile.js: CDN ${i + 1} 加载失败:`, error.message);
            if (i === urls.length - 1) {
                throw new Error(`所有 ${urls.length} 个 ${libName} 加载源均失败。可能原因：
1. 本地文件缺失（请运行 node download-libs.js 下载库文件）
2. 网络连接问题（如果使用 CDN 备用源）
3. 防火墙/代理限制

建议：
- 检查 libs 目录是否存在且包含所需文件
- 如果文件缺失，运行 node download-libs.js 下载
- 重新加载扩展`);
            }
        }
    }
}

/**
 * 加载单个 JS 脚本（带超时机制）
 * @param {string} url - 脚本 URL
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
function loadScript(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        
        // 超时定时器
        const timer = setTimeout(() => {
            script.remove();
            reject(new Error(`加载超时（${timeout/1000}秒）`));
        }, timeout);
        
        script.onload = () => {
            clearTimeout(timer);
            resolve();
        };
        
        script.onerror = (event) => {
            clearTimeout(timer);
            script.remove();
            reject(new Error(`无法从 ${url} 加载脚本`));
        };
        
        document.head.appendChild(script);
    });
}

/**
 * 确保 PDF.js 已加载
 * @returns {Promise<void>}
 */
async function ensurePdfJsLoaded() {
    if (libraryStatus.pdfjs.loaded) {
        return; // 已加载，直接返回
    }
    
    if (libraryStatus.pdfjs.loading) {
        // 正在加载中，等待加载完成
        while (libraryStatus.pdfjs.loading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (libraryStatus.pdfjs.loaded) return;
    }
    
    libraryStatus.pdfjs.loading = true;
    
    try {
        // 尝试多个 CDN 加载 PDF.js
        await loadLibraryWithFallback(
            CDN_CONFIGS.pdfjs.map(cdn => cdn.main),
            'PDF.js',
            'pdfjsLib'
        );
        
        // 配置 worker（使用与主库相同的 CDN）
        const loadedCdnIndex = CDN_CONFIGS.pdfjs.findIndex(() => typeof pdfjsLib !== 'undefined');
        if (loadedCdnIndex >= 0) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_CONFIGS.pdfjs[loadedCdnIndex].worker;
            console.log(`⚙️ PDF.js Worker 配置完成:`, pdfjsLib.GlobalWorkerOptions.workerSrc);
        }
        
        libraryStatus.pdfjs.loaded = true;
    } catch (error) {
        throw new Error(`PDF.js 加载失败: ${error.message}`);
    } finally {
        libraryStatus.pdfjs.loading = false;
    }
}

/**
 * 确保 mammoth.js 已加载
 * @returns {Promise<void>}
 */
async function ensureMammothLoaded() {
    if (libraryStatus.mammoth.loaded) {
        return;
    }
    
    if (libraryStatus.mammoth.loading) {
        while (libraryStatus.mammoth.loading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        if (libraryStatus.mammoth.loaded) return;
    }
    
    libraryStatus.mammoth.loading = true;
    
    try {
        await loadLibraryWithFallback(
            CDN_CONFIGS.mammoth,
            'mammoth.js',
            'mammoth'
        );
        
        libraryStatus.mammoth.loaded = true;
    } catch (error) {
        throw new Error(`mammoth.js 加载失败: ${error.message}`);
    } finally {
        libraryStatus.mammoth.loading = false;
    }
}

/**
 * 解析简历文件的主函数
 * @param {File} file - 浏览器 File 对象（PDF/Word）
 * @param {string} apiKey - AI API Key（从 chrome.storage.config 获取）
 * @param {string} model - AI 模型名称（从 chrome.storage.config 获取）
 * @param {Function} progressCallback - 进度回调函数 (step, total, message)
 * @returns {Promise<Object>} 符合 popup.js 使用的 profile 结构的对象
 * @throws {Error} 解析失败时抛出错误
 */
async function parseResumeFile(file, apiKey, model, progressCallback) {
    console.log('📄 profile.js: 开始解析简历文件', file.name);
    
    // 校验 API Key
    if (!apiKey || !apiKey.trim()) {
        throw new Error('API Key 未配置，请先到设置页面配置 API Key');
    }
    
    const updateProgress = progressCallback || (() => {}); // 默认空函数
    
    try {
        // 第一步：根据文件类型提取纯文本
        updateProgress(1, 3, '提取文件文本...');
        console.log('📖 profile.js: 提取文件文本内容...');
        let extractedText = '';
        
        const fileName = file.name.toLowerCase();
        if (fileName.endsWith('.pdf')) {
            extractedText = await extractTextFromPDF(file);
        } else if (fileName.endsWith('.docx')) {
            extractedText = await extractTextFromWord(file, updateProgress);
        } else if (fileName.endsWith('.doc')) {
            throw new Error('不支持旧版 .doc 格式，请将文件另存为 .docx 或 PDF 格式');
        } else {
            throw new Error('不支持的文件格式');
        }
        
        if (!extractedText || extractedText.trim().length === 0) {
            throw new Error('未能从文件中提取到文本内容，请检查文件是否为空或损坏');
        }
        
        console.log('✅ profile.js: 文本提取成功，共', extractedText.length, '个字符');
        console.log('📝 提取内容预览:', extractedText.substring(0, 200) + '...');
        
        // 第二步：调用 AI API 解析纯文本
        updateProgress(2, 3, 'AI 解析中（这可能需要 10-30 秒）...');
        console.log('🌐 profile.js: 调用 AI API 解析简历内容');
        const parsedData = await callAIParseAPI(extractedText, file.name, apiKey, model);
        
        // 第三步：规范化数据并返回
        updateProgress(3, 3, '处理数据...');
        const profileObject = normalizeToProfile(parsedData);
        console.log('✅ profile.js: 规范化完成', profileObject);
        return profileObject;
        
    } catch (error) {
        console.error('❌ profile.js: 解析失败', error);
        throw error; // 抛出给调用方处理
    }
}

/**
 * 从 PDF 文件中提取纯文本
 * @param {File} file - PDF 文件对象
 * @returns {Promise<string>} 提取的纯文本内容
 */
async function extractTextFromPDF(file) {
    console.log('📕 profile.js: 开始解析 PDF 文件...');
    
    // 动态加载 PDF.js（支持多 CDN 自动切换）
    await ensurePdfJsLoaded();
    
    // 读取文件为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 加载 PDF 文档
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`📄 PDF 共 ${pdf.numPages} 页`);
    
    // 并行提取所有页面的文本（提高速度）
    const pagePromises = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        pagePromises.push(
            pdf.getPage(pageNum).then(page => {
                return page.getTextContent().then(textContent => {
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    console.log(`✅ 第 ${pageNum} 页提取完成，共 ${pageText.length} 字符`);
                    return { pageNum, text: pageText };
                });
            })
        );
    }
    
    // 等待所有页面提取完成，然后按页码排序
    const pageTexts = await Promise.all(pagePromises);
    pageTexts.sort((a, b) => a.pageNum - b.pageNum);
    const fullText = pageTexts.map(p => p.text).join('\n');
    
    return fullText.trim();
}

/**
 * 从 Word (.docx) 文件中提取纯文本（优化版：添加超时控制）
 * @param {File} file - Word 文件对象
 * @param {Function} progressCallback - 进度回调函数（可选）
 * @returns {Promise<string>} 提取的纯文本内容
 */
async function extractTextFromWord(file, progressCallback) {
    console.log('📘 profile.js: 开始解析 Word 文件...', `文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    
    // 检查文件大小，对超大文件给出警告
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > 5) {
        console.warn(`⚠️ 文件较大（${fileSizeMB.toFixed(2)} MB），解析可能需要较长时间`);
        if (progressCallback) {
            progressCallback(1, 3, `正在解析大型文件（${fileSizeMB.toFixed(2)} MB）...`);
        }
    }
    
    // 动态加载 mammoth.js（支持多 CDN 自动切换）
    if (progressCallback) {
        progressCallback(1, 3, '加载 Word 解析库...');
    }
    await ensureMammothLoaded();
    
    // 读取文件为 ArrayBuffer（添加超时控制）
    if (progressCallback) {
        progressCallback(1, 3, '读取文件内容...');
    }
    
    const readTimeout = 30000; // 30秒读取超时
    const readPromise = file.arrayBuffer();
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`文件读取超时（${readTimeout/1000}秒）`)), readTimeout)
    );
    
    let arrayBuffer;
    try {
        arrayBuffer = await Promise.race([readPromise, timeoutPromise]);
    } catch (error) {
        if (error.message.includes('超时')) {
            throw new Error(`文件读取超时。文件可能过大（${fileSizeMB.toFixed(2)} MB），建议压缩文件或转换为 PDF 格式`);
        }
        throw error;
    }
    
    // 使用 mammoth 提取文本（添加超时控制）
    if (progressCallback) {
        progressCallback(1, 3, '提取文本内容...');
    }
    
    const extractTimeout = 60000; // 60秒提取超时（对大型文件）
    const extractPromise = mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    const extractTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`文本提取超时（${extractTimeout/1000}秒）`)), extractTimeout)
    );
    
    let result;
    try {
        result = await Promise.race([extractPromise, extractTimeoutPromise]);
    } catch (error) {
        if (error.message.includes('超时')) {
            throw new Error(`Word 文件解析超时（${extractTimeout/1000}秒）。文件可能过于复杂或损坏。建议：
1. 尝试将文件另存为 PDF 格式
2. 检查文件是否损坏
3. 如果文件包含大量图片，考虑移除图片后重试`);
        }
        throw error;
    }
    
    console.log('✅ Word 文本提取完成，共', result.value.length, '字符');
    
    if (result.messages && result.messages.length > 0) {
        console.warn('⚠️ mammoth 解析警告:', result.messages);
    }
    
    return result.value.trim();
}

/**
 * 检测网络连接问题和地理位置限制
 * @returns {Promise<{isBlocked: boolean, reason?: string, details?: any}>}
 */
async function detectNetworkIssue() {
    try {
        // 尝试访问一个简单的测试端点（缩短超时到3秒，快速失败）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        try {
            const response = await fetch('https://api.siliconflow.cn/v1/models', {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok || response.status === 401) {
                // 401 表示服务器可达，只是需要认证
                return { isBlocked: false };
            } else {
                return { 
                    isBlocked: true, 
                    reason: `服务器返回错误: HTTP ${response.status}`,
                    details: { status: response.status, statusText: response.statusText }
                };
            }
        } catch (error) {
            clearTimeout(timeoutId);
            
            // 分析错误类型
            if (error.name === 'AbortError') {
                return { 
                    isBlocked: true, 
                    reason: '连接超时（3秒内无响应）',
                    details: { errorType: 'timeout' }
                };
            }
            
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                return { 
                    isBlocked: true, 
                    reason: '网络连接失败（可能是防火墙或地理位置限制）',
                    details: { 
                        errorType: 'network',
                        errorMessage: error.message,
                        suggestion: '如果在中国大陆，可能需要使用VPN或代理访问'
                    }
                };
            }
            
            return { 
                isBlocked: true, 
                reason: error.message,
                details: { errorType: 'unknown', errorMessage: error.message }
            };
        }
    } catch (error) {
        return { 
            isBlocked: true, 
            reason: '无法检测网络状态',
            details: { errorMessage: error.message }
        };
    }
}

/**
 * 测试网络连接到 API 服务器
 * @param {string} apiKey - API Key
 * @returns {Promise<{success: boolean, error?: string, latency?: number, networkIssue?: any}>}
 */
async function testAPIConnection(apiKey) {
    try {
        // 先检测网络问题
        const networkCheck = await detectNetworkIssue();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/574377c9-6e22-46d9-86c6-10d078667423',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.js:321',message:'network issue detection',data:networkCheck,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        if (networkCheck.isBlocked) {
            return { 
                success: false, 
                error: networkCheck.reason,
                networkIssue: networkCheck
            };
        }
        
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 缩短到5秒测试超时，快速失败
        
        try {
            const response = await fetch('https://api.siliconflow.cn/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const latency = Date.now() - startTime;
            
            if (response.ok) {
                return { success: true, latency };
            } else {
                return { success: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                return { success: false, error: '连接超时（5秒）' };
            }
            return { success: false, error: error.message };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * 调用 AI API 解析简历纯文本内容
 * @param {string} textContent - 提取的纯文本内容
 * @param {string} fileName - 文件名
 * @param {string} apiKey - API Key
 * @param {string} model - 模型名称
 * @returns {Promise<Object>} AI 返回的结构化简历数据
 */
async function callAIParseAPI(textContent, fileName, apiKey, model) {
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

    // 智能文本截断策略：优先保留关键信息部分
    const maxTextLength = 12000; // 增加到 12000 字符，提高解析完整性
    let truncatedText = textContent;
    
    if (textContent.length > maxTextLength) {
        console.log(`⚠️ 文本过长（${textContent.length} 字符），将智能截断至 ${maxTextLength} 字符`);
        
        // 智能截断：优先保留前半部分（通常包含关键信息）和后半部分（可能包含补充信息）
        // 策略：保留前70% + 后30%，确保关键信息不丢失
        const frontPart = Math.floor(maxTextLength * 0.7);
        const backPart = maxTextLength - frontPart;
        const frontText = textContent.substring(0, frontPart);
        const backText = textContent.substring(textContent.length - backPart);
        
        truncatedText = frontText + '\n\n[... 中间部分已省略 ...]\n\n' + backText;
        console.log(`📝 智能截断：保留前 ${frontPart} 字符 + 后 ${backPart} 字符`);
    }
    
    const userPrompt = `请解析以下简历文件（${fileName}）中的内容，提取所有结构化信息：\n\n${truncatedText}`;

    console.log('🤖 profile.js: 调用 AI API，模型:', model);
    console.log(`📊 请求文本长度: ${truncatedText.length} 字符`);
    
    // 快速网络连接测试（缩短到2秒超时，避免阻塞太久）
    console.log('🔍 快速检测网络连接（2秒超时）...');
    const connectionTest = await Promise.race([
        testAPIConnection(apiKey),
        new Promise(resolve => setTimeout(() => resolve({ success: false, error: '检测超时（跳过检测）' }), 2000))
    ]);
    
    if (!connectionTest.success && connectionTest.error !== '检测超时（跳过检测）') {
        let errorMessage = `无法连接到 API 服务器：${connectionTest.error}`;
        
        // 如果有网络问题详情，提供更具体的建议
        if (connectionTest.networkIssue) {
            const issue = connectionTest.networkIssue;
            if (issue.reason && (issue.reason.includes('地理位置限制') || issue.reason.includes('防火墙'))) {
                errorMessage += `\n\n⚠️ 检测到网络访问限制问题。`;
                errorMessage += `\n\n可能原因：`;
                errorMessage += `\n1. 地理位置限制：api.siliconflow.cn 可能在中国大陆无法直接访问`;
                errorMessage += `\n2. 防火墙/GFW 阻止：网络防火墙可能阻止了对该域名的访问`;
                errorMessage += `\n3. DNS 解析问题：可能无法正确解析域名`;
                errorMessage += `\n\n解决方案：`;
                errorMessage += `\n1. 使用 VPN 或代理服务（将 IP 地址切换到非中国大陆）`;
                errorMessage += `\n2. 配置系统代理设置`;
                errorMessage += `\n3. 检查防火墙规则，允许访问 api.siliconflow.cn`;
                errorMessage += `\n4. 尝试更换 DNS 服务器（如 8.8.8.8 或 1.1.1.1）`;
                errorMessage += `\n5. 联系网络管理员检查网络策略`;
            } else {
                errorMessage += `\n\n请检查：`;
                errorMessage += `\n1. 网络连接是否正常`;
                errorMessage += `\n2. 是否使用了代理/VPN（如果在中国大陆，可能需要开启）`;
                errorMessage += `\n3. 防火墙是否阻止了连接`;
                errorMessage += `\n4. API 服务是否可用`;
            }
        } else {
            errorMessage += `\n\n请检查：`;
            errorMessage += `\n1. 网络连接是否正常`;
            errorMessage += `\n2. 是否使用了代理/VPN（如果在中国大陆，可能需要开启）`;
            errorMessage += `\n3. 防火墙是否阻止了连接`;
            errorMessage += `\n4. API 服务是否可用`;
        }
        
        throw new Error(errorMessage);
    }
    
    if (connectionTest.success) {
        console.log(`✅ API 服务器连接正常，延迟: ${connectionTest.latency}ms`);
    } else {
        console.log('⚠️ 网络检测超时，继续尝试调用 API...');
    }
    
    // #region agent log
    const requestBody = {
        model: model || "Qwen/Qwen2.5-72B-Instruct",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8192
    };
    const requestBodyStr = JSON.stringify(requestBody);
    const requestBodySize = new Blob([requestBodyStr]).size;
    fetch('http://127.0.0.1:7242/ingest/574377c9-6e22-46d9-86c6-10d078667423',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.js:404',message:'before fetch API call',data:{url:'https://api.siliconflow.cn/v1/chat/completions',model,apiKeyLength:apiKey?.length||0,textContentLength:textContent.length,requestBodySize,hasApiKey:!!apiKey,connectionLatency:connectionTest.latency},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    // 重试配置（优化版）
    const maxRetries = 1; // 减少到最多重试 1 次（总共 2 次尝试），避免总耗时过长
    const fetchTimeout = 180000; // 增加到 180 秒超时（对大型简历和慢速网络更友好）
    const retryDelay = 2000; // 缩短重试延迟到 2 秒
    
    // 记录请求体大小
    const requestBodySizeKB = (requestBodySize / 1024).toFixed(1);
    console.log(`📦 请求体大小: ${requestBodySizeKB} KB`);
    if (requestBodySize > 100 * 1024) { // 超过 100KB
        console.warn(`⚠️ 请求体较大（${requestBodySizeKB} KB），可能影响传输速度`);
    }
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/574377c9-6e22-46d9-86c6-10d078667423',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.js:410',message:'fetch call started',data:{url:'https://api.siliconflow.cn/v1/chat/completions',timeout:fetchTimeout,attempt:attempt+1,maxAttempts:maxRetries+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            
            if (attempt > 0) {
                console.log(`🔄 第 ${attempt + 1} 次尝试调用 AI API...`);
                // 重试前等待
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            // 使用 AbortController 实现超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort();
            }, fetchTimeout);
            
            try {
                const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: requestBodyStr,
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/574377c9-6e22-46d9-86c6-10d078667423',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.js:422',message:'fetch call completed',data:{status:response.status,statusText:response.statusText,ok:response.ok,attempt:attempt+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
                
                // HTTP 状态码检查
                if (!response.ok) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/574377c9-6e22-46d9-86c6-10d078667423',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.js:437',message:'HTTP response not ok',data:{status:response.status,statusText:response.statusText,attempt:attempt+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    const errorText = await response.text();
                    throw new Error(`AI API 调用失败 (HTTP ${response.status}): ${errorText}`);
                }
                
                // 解析响应
                const data = await response.json();
                console.log('📦 profile.js: AI API 返回数据', data);
                
                if (data.error) {
                    throw new Error(`AI API 错误: ${data.error.message || JSON.stringify(data.error)}`);
                }
                
                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    throw new Error('AI API 返回格式异常，无法获取解析结果');
                }
                
                const content = data.choices[0].message.content;
                console.log('🤖 profile.js: AI 返回内容', content);
                
                // 解析 JSON
                try {
                    return JSON.parse(content);
                } catch (e) {
                    throw new Error(`AI 返回内容不是有效的 JSON: ${e.message}`);
                }
                
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/574377c9-6e22-46d9-86c6-10d078667423',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'profile.js:424',message:'fetch call failed',data:{errorName:fetchError.name,errorMessage:fetchError.message,isAborted:fetchError.name==='AbortError',attempt:attempt+1,willRetry:attempt<maxRetries},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                
                lastError = fetchError;
                
                // 如果是最后一次尝试，抛出错误
                if (attempt === maxRetries) {
                    // 处理超时错误（优化错误信息）
                    if (fetchError.name === 'AbortError') {
                        const connectionInfo = connectionTest.success ? `（连接测试延迟: ${connectionTest.latency}ms）` : `（连接测试失败: ${connectionTest.error}）`;
                        const timeoutMinutes = (fetchTimeout / 1000 / 60).toFixed(1);
                        throw new Error(`请求超时（${timeoutMinutes}分钟），已重试 ${maxRetries} 次仍失败${connectionInfo}。

可能原因：
1. 网络连接不稳定或速度较慢（当前请求体: ${requestBodySizeKB} KB）
2. API 服务器响应极慢或暂时不可用
3. 简历文件过大或内容过于复杂
4. 代理/VPN 导致延迟过高
5. 防火墙或安全软件阻止

解决方案：
1. 检查网络连接速度（建议至少 2Mbps）
2. 尝试将简历转换为 PDF 格式（通常更小）
3. 如果使用代理/VPN，尝试关闭或更换节点
4. 检查防火墙设置，允许访问 api.siliconflow.cn
5. 稍后重试（可能是 API 服务临时高负载）
6. 如果问题持续，考虑使用较小的简历文件或联系 API 服务提供商`);
                    }
                    
                    // 处理其他网络错误
                    if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
                        throw new Error(`网络请求失败 (Failed to fetch)，已重试 ${maxRetries} 次仍失败。可能原因：
1. 网络连接问题（请检查网络连接）
2. API 服务器不可用（请稍后重试）
3. 代理/VPN 设置问题（尝试关闭代理）
4. 防火墙阻止请求（检查防火墙设置）
5. DNS 解析失败（检查 DNS 设置）

原始错误: ${fetchError.message}`);
                    }
                    
                    // 如果是其他类型的错误（如 HTTP 错误），直接抛出
                    throw fetchError;
                }
                
                // 如果不是最后一次尝试，继续重试
                console.warn(`⚠️ 第 ${attempt + 1} 次尝试失败，${retryDelay/1000} 秒后重试...`, fetchError.message);
                continue;
            }
        } catch (error) {
            // 如果错误已经被处理过或者是最后一次尝试，直接抛出
            if (error.message && (error.message.includes('请求超时') || error.message.includes('网络请求失败') || error.message.includes('AI API'))) {
                throw error;
            }
            // 其他未预期的错误
            throw new Error(`API 调用出错: ${error.message}`);
        }
    }
    
    // 理论上不会到达这里，但为了安全起见
    throw lastError || new Error('API 调用失败：未知错误');
}

/**
 * 将后端返回的 JSON 规范化为 profile 结构
 * @param {Object} data - 后端返回的 JSON 数据
 * @returns {Object} 规范化后的 profile 对象
 */
function normalizeToProfile(data) {
    // 确保所有字段都存在，即使后端没有返回
    return {
        // 基本信息
        basic: data.basic || {},
        
        // 多条目维度（数组）
        education: Array.isArray(data.education) ? data.education : [],
        award: Array.isArray(data.award) ? data.award : [],
        competition: Array.isArray(data.competition) ? data.competition : [],
        project: Array.isArray(data.project) ? data.project : [],
        internship: Array.isArray(data.internship) ? data.internship : [],
        workExperience: Array.isArray(data.workExperience) ? data.workExperience : [],
        language: Array.isArray(data.language) ? data.language : [],
        certificate: Array.isArray(data.certificate) ? data.certificate : [],
        familyMembers: Array.isArray(data.familyMembers) ? data.familyMembers : [],
        
        // 嵌套数组维度
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
        
        // 单字段维度
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

// 将函数暴露到全局作用域，供 popup.js 调用
window.parseResumeFile = parseResumeFile;
// 暴露文本提取函数，供快速填充使用
window.extractTextFromPDF = extractTextFromPDF;
window.extractTextFromWord = extractTextFromWord;

console.log('✅ profile.js 已加载');
