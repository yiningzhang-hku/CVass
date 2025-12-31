/* START OF FILE content_script.js */

(function() {
    if (window.__JOB_AUTOFILL_AI_INSTALLED__) return;
    window.__JOB_AUTOFILL_AI_INSTALLED__ = true;

    // --- 工具: React 兼容赋值（增强版，改进事件触发顺序）---
    function setNativeValue(element, value) {
        // 检测是否在React/Vue环境中
        const isReact = element.__reactInternalInstance || 
                       element._reactInternalFiber || 
                       element.__reactInternalInstanceKey ||
                       (element.ownerDocument && element.ownerDocument.defaultView && 
                        element.ownerDocument.defaultView.React);
        const isVue = element.__vue__ || 
                     (element.ownerDocument && element.ownerDocument.defaultView && 
                      element.ownerDocument.defaultView.Vue);
        
        // 先触发 focus 事件（某些框架需要）
        try {
            element.focus();
            element.dispatchEvent(new Event('focus', { bubbles: true, cancelable: true }));
        } catch (e) {
            // 忽略错误，继续执行
        }
        
        // 使用原生setter，确保React/Vue能检测到变化
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value"
        )?.set;
        if (nativeInputValueSetter) {
            try {
                nativeInputValueSetter.call(element, value);
            } catch (e) {
                element.value = value;
            }
        } else {
            element.value = value;
        }
        
        // 触发完整的事件序列（按正确顺序）
        const events = [
            { type: 'input', useInputEvent: true },
            { type: 'change', useInputEvent: false },
            { type: 'blur', useInputEvent: false }
        ];
        
        events.forEach(eventConfig => {
            try {
                let event;
                if (eventConfig.useInputEvent && eventConfig.type === 'input') {
                    // 使用 InputEvent 以获得更好的兼容性
                    try {
                        event = new InputEvent('input', {
                            bubbles: true,
                            cancelable: true,
                            data: String(value),
                            inputType: 'insertText'
                        });
                    } catch (e) {
                        event = new Event('input', { bubbles: true, cancelable: true });
                    }
                } else {
                    event = new Event(eventConfig.type, { 
                        bubbles: true, 
                        cancelable: true 
                    });
                }
                element.dispatchEvent(event);
            } catch (e) {
                // 如果浏览器不支持某些事件类型，使用基本Event
                const event = new Event(eventConfig.type, { bubbles: true });
                element.dispatchEvent(event);
            }
        });
        
        // 对于React，可能需要触发额外的合成事件
        if (isReact) {
            try {
                const syntheticEvent = new Event('input', { bubbles: true, cancelable: true });
                Object.defineProperty(syntheticEvent, 'target', { 
                    value: element, 
                    writable: false, 
                    configurable: false 
                });
                Object.defineProperty(syntheticEvent, 'currentTarget', { 
                    value: element, 
                    writable: false, 
                    configurable: false 
                });
                element.dispatchEvent(syntheticEvent);
            } catch (e) {
                // 忽略错误
            }
        }
    }

    // --- 工具: 生成元素的CSS选择器路径 ---
    /**
     * 生成元素的CSS选择器路径，用于创建稳定的元素标识
     * @param {HTMLElement} element - 目标元素
     * @returns {string} CSS选择器路径，如 "div > form > input:nth-of-type(2)"
     */
    function getElementPath(element) {
        if (!element || !element.parentElement) return '';
        
        const path = [];
        let current = element;
        
        while (current && current !== document.body && current !== document.documentElement) {
            let selector = current.tagName.toLowerCase();
            
            // 优先使用ID
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            }
            
            // 使用类名（如果有）
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.trim().split(/\s+/).filter(c => c).slice(0, 2);
                if (classes.length > 0) {
                    selector += '.' + classes.join('.');
                }
            }
            
            // 计算同类型兄弟元素的索引
            let sibling = current;
            let index = 1;
            while (sibling.previousElementSibling) {
                sibling = sibling.previousElementSibling;
                if (sibling.tagName === current.tagName) {
                    index++;
                }
            }
            
            if (index > 1) {
                selector += `:nth-of-type(${index})`;
            }
            
            path.unshift(selector);
            current = current.parentElement;
        }
        
        return path.join(' > ');
    }

    // --- 工具: 简单哈希函数 ---
    /**
     * 生成字符串的简单哈希值
     * @param {string} str - 输入字符串
     * @returns {string} 哈希值（十六进制字符串）
     */
    function simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString(16);
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        return Math.abs(hash).toString(16);
    }

    // --- 工具: 下拉框模糊匹配（新增）---
    function findSelectOption(select, value) {
        const options = Array.from(select.options);
        const normalize = (str) => str.toLowerCase().trim().replace(/[\s\-_\(\)（）【】\[\]：:、，。]+/g, '');
        const normalizedValue = normalize(String(value));
        
        // 1. 精确匹配（值和文本）
        let match = options.findIndex(opt => {
            const optText = normalize(opt.text);
            const optValue = normalize(opt.value);
            return optText === normalizedValue || optValue === normalizedValue;
        });
        if (match !== -1) return { index: match, option: options[match] };
        
        // 2. 包含匹配（双向）
        match = options.findIndex(opt => {
            const optText = normalize(opt.text);
            const optValue = normalize(opt.value);
            return optText.includes(normalizedValue) || 
                   normalizedValue.includes(optText) ||
                   optValue.includes(normalizedValue) ||
                   normalizedValue.includes(optValue);
        });
        if (match !== -1) return { index: match, option: options[match] };
        
        // 3. 前缀匹配（支持"本科"匹配"本科学历"）
        match = options.findIndex(opt => {
            const optText = normalize(opt.text);
            const optValue = normalize(opt.value);
            return optText.startsWith(normalizedValue) || 
                   normalizedValue.startsWith(optText) ||
                   optValue.startsWith(normalizedValue) ||
                   normalizedValue.startsWith(optValue);
        });
        if (match !== -1) return { index: match, option: options[match] };
        
        // 4. 模糊匹配（去除所有标点后匹配）
        const cleanValue = normalizedValue.replace(/[^\w\u4e00-\u9fa5]/g, '');
        match = options.findIndex(opt => {
            const cleanText = normalize(opt.text).replace(/[^\w\u4e00-\u9fa5]/g, '');
            const cleanOptValue = normalize(opt.value).replace(/[^\w\u4e00-\u9fa5]/g, '');
            return cleanText.includes(cleanValue) || 
                   cleanValue.includes(cleanText) ||
                   cleanOptValue.includes(cleanValue) ||
                   cleanValue.includes(cleanOptValue);
        });
        
        if (match !== -1) return { index: match, option: options[match] };
        return null;
    }

    // --- 自动扩展表单 (支持所有新维度) ---
    async function expandFormSections(counts) {
        console.log("JobAutoFill: 开始扩展表单...", counts);
        
        // 扩展的关键词映射
        const keywords = {
            education: ['添加教育', 'Add Education', '增加教育', '添加学历', '新增教育'],
            internship: ['添加实习', 'Add Internship', '增加实习', '新增实习'],
            workExperience: ['添加工作', 'Add Work', 'Add Experience', '增加工作', '新增工作经历'],
            project: ['添加项目', 'Add Project', '增加项目', '新增项目'],
            award: ['添加获奖', 'Add Award', '增加获奖', '添加奖项', '荣誉'],
            competition: ['添加竞赛', 'Add Competition', '增加竞赛', '比赛'],
            language: ['添加语言', 'Add Language', '增加语言', '外语'],
            certificate: ['添加证书', 'Add Certificate', '增加证书', '资格证'],
            familyMembers: ['添加家庭', 'Add Family', '增加家属', '家庭成员'],
            campusLeader: ['添加职务', 'Add Position', '学生干部', '职务'],
            campusActivity: ['添加活动', 'Add Activity', '校园活动'],
            volunteer: ['添加志愿', 'Add Volunteer', '志愿活动', '公益'],
            socialProject: ['添加社会实践', 'Add Social', '社会实践'],
            paper: ['添加论文', 'Add Paper', '增加论文', '发表'],
            patent: ['添加专利', 'Add Patent', '增加专利'],
            conference: ['添加会议', 'Add Conference', '学术会议']
        };

        function findAddButton(sectionKeywords) {
            const candidates = document.querySelectorAll('button, a, div[role="button"], span.add-btn, i, .btn-add');
            for (let el of candidates) {
                if (el.offsetParent === null) continue;
                const text = (el.innerText || el.textContent || "").trim().toLowerCase();
                const match = sectionKeywords.some(k => text.includes(k.toLowerCase()));
                if (match) return el;
            }
            return null;
        }

        // 等待表单扩展完成的辅助函数（使用轮询检测）
        async function waitForFormExpansion(containerSelector, expectedCount, maxWait = 5000) {
            const pollInterval = 100; // 每100ms检查一次
            let elapsed = 0;
            
            while (elapsed < maxWait) {
                // 尝试多种选择器来检测表单项
                const containers = document.querySelectorAll(containerSelector);
                let currentCount = 0;
                
                containers.forEach(container => {
                    // 查找常见的表单项选择器
                    const items = container.querySelectorAll(
                        '.form-item, .list-item, [class*="item"], [class*="form"], fieldset, .field-group'
                    );
                    currentCount = Math.max(currentCount, items.length);
                });
                
                // 如果没有找到容器，尝试通过输入框数量推断
                if (currentCount === 0) {
                    const allInputs = document.querySelectorAll('input, select, textarea');
                    // 粗略估算：如果有更多输入框，可能已经扩展
                    if (allInputs.length >= expectedCount * 3) {
                        return true;
                    }
                }
                
                if (currentCount >= expectedCount) {
                    return true;
                }
                
                await new Promise(r => setTimeout(r, pollInterval));
                elapsed += pollInterval;
            }
            
            return false; // 超时
        }

        async function processSection(type, userCount) {
            if (userCount <= 1) return;
            const sectionKw = keywords[type];
            if (!sectionKw) return;
            
            let btn = findAddButton(sectionKw);
            if (btn) {
                const clicksNeeded = Math.min(userCount - 1, 5);
                
                // 尝试找到容器选择器（用于检测扩展完成）
                let containerSelector = '';
                let parent = btn.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.id || parent.className) {
                        containerSelector = parent.id ? `#${parent.id}` : `.${parent.className.split(' ')[0]}`;
                        break;
                    }
                    parent = parent.parentElement;
                }
                
                for (let i = 0; i < clicksNeeded; i++) {
                    btn.click();
                    
                    // 使用轮询检测替代固定延迟
                    if (containerSelector) {
                        await waitForFormExpansion(containerSelector, i + 2, 3000);
                    } else {
                        // 如果没有找到容器，使用较短延迟
                        await new Promise(r => setTimeout(r, 300));
                    }
                }
            }
        }

        // 处理所有维度
        for (const [type, count] of Object.entries(counts)) {
            await processSection(type, count);
        }
    }

    // ========== 关键字段模式定义（与 content.js 保持一致）==========
    const keyFieldPatterns = /学校|school|公司|company|项目名|project name|获奖名|award|赛事|competition|论文|paper|专利|patent|证书|certificate|姓名.*(?:家|亲)/i;
    
    // 多段维度类型列表
    const multiSectionContexts = ['Education', 'Work/Internship', 'Work Experience', 'Project', 'Award', 'Competition', 
                                   'Language', 'Certificate', 'Family', 'Campus Leader', 'Campus Activity', 
                                   'Volunteer', 'Social Project', 'Paper', 'Patent', 'Conference'];
    
    // --- 核心：智能上下文识别（支持所有新维度，性能优化版）---
    // 使用 WeakMap 缓存已解析的结果
    const contextCache = new WeakMap();
    
    // 辅助函数：检查 label 是否匹配基础信息字段
    function isBasicInfoField(labelText) {
        if (!labelText) return false;
        
        // 定义基础信息字段的关键词（与 content.js 保持一致）
        const basicKeywords = {
            name: ['姓名', 'name', 'full name', '中文名', '真实姓名', '中文姓名', '申请人姓名', '应聘者姓名'],
            phone: ['手机', '电话', 'phone', 'mobile', 'cellphone', '联系电话', '手机号', '手机号码'],
            email: ['邮箱', 'email', 'mail', '电子邮箱', 'e-mail'],
            gender: ['性别', 'gender', 'sex'],
            birthDate: ['出生日期', 'birth', 'birthday', '出生年月', '生日'],
            ethnicity: ['民族', 'ethnicity', 'ethnic'],
            nationality: ['国籍', 'nationality', 'citizenship'],
            hometown: ['户籍', 'hometown', '籍贯', '户口所在地', '户籍所在'],
            currentAddress: ['现居', 'current address', '居住地', '现住址', '目前住址'],
            maritalStatus: ['婚姻', 'marital', '婚姻状况', 'married'],
            politicalStatus: ['政治面貌', 'political', '党派'],
            height: ['身高', 'height'],
            weight: ['体重', 'weight']
        };
        
        const normalize = (str) => str.toLowerCase().replace(/[\s\-_\(\)（）【】\[\]：:、，。]+/g, '');
        const normalizedLabel = normalize(labelText);
        
        for (const key in basicKeywords) {
            if (basicKeywords[key].some(keyword => {
                const normalizedKey = normalize(keyword);
                return normalizedLabel === normalizedKey || 
                       normalizedLabel.includes(normalizedKey) || 
                       normalizedKey.includes(normalizedLabel);
            })) {
                return true;
            }
        }
        return false;
    }
    
    function detectSectionContext(element, labelText) {
        try {
            // 检查缓存
            if (contextCache.has(element)) {
                return contextCache.get(element);
            }
                
            // 如果没有传入 labelText，尝试获取
            if (!labelText) {
                labelText = getLabelText(element);
            }
                
            // 【优先级1】首先检查字段标签本身，如果是明确的基础信息字段，直接识别为 Basic Info
            if (labelText) {
                // 检查是否是基础信息字段
                if (isBasicInfoField(labelText)) {
                    const result = {
                        context: 'Basic Info',
                        index: 0
                    };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 【恢复】基于 label 的教育/实习/项目等 context 判断（但不设置 index）
                // 这样可以避免 context='Unknown' 导致字段失联
                const labelLower = labelText.toLowerCase();
                    
                // 教育相关
                if (['学校', '学校名称', '毕业院校', '就读院校', 'school', '专业', 'major', '学位', 'degree', '学历', 'gpa', '绩点'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Education', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 实习/工作相关
                if (['公司', '单位', 'company', '职位', 'position', '岗位', '部门', 'department'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Work/Internship', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 项目相关
                if (['项目名称', '项目名', 'project name', 'project'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Project', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 获奖相关
                if (['获奖名称', '奖项名称', '荣誉名称', 'award name', 'award'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Award', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 竞赛相关
                if (['赛事名称', '竞赛名称', '比赛名称', 'competition name', 'competition'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Competition', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 语言相关
                if (['语言', 'language', '外语'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Language', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 证书相关
                if (['证书名称', '证书', 'certificate'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Certificate', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 论文相关
                if (['论文题目', '论文名称', 'paper title', 'paper'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Paper', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
                    
                // 专利相关
                if (['专利名称', 'patent name', 'patent'].some(kw => labelLower.includes(kw))) {
                    const result = { context: 'Patent', index: 0 };
                    contextCache.set(element, result);
                    return result;
                }
            }
            
            let current = element.parentElement;
            let depth = 0;
            const maxDepth = 10;
            let detectedContext = 'Unknown';
            let sectionIndex = 0;

            while (current && depth < maxDepth) {
                // 优先获取标题元素的文本（使用 textContent，避免触发重排）
                const headerCandidates = current.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, .title, .header, strong, span.section-label, .section-title, .card-title');
                
                let foundText = "";
                
                // 优先只获取标题文本
                if (headerCandidates.length > 0) {
                    headerCandidates.forEach(h => {
                        const headerText = (h.textContent || '').trim();
                        if (headerText) {
                            foundText += " " + headerText;
                        }
                    });
                }
                
                // 如果标题文本为空，才获取父元素的部分文本（前100字符）
                if (!foundText.trim()) {
                    const parentText = (current.textContent || '').trim();
                    if (parentText.length > 0) {
                        foundText = parentText.substring(0, 100);
                    }
                }
                
                const text = foundText.toLowerCase();

            // 提取索引（支持多种格式）
            const indexPatterns = [
                /(?:教育|education|学历).*?(\d+)/i,
                /(?:工作|work|实习|intern|experience).*?(\d+)/i,
                /(?:项目|project).*?(\d+)/i,
                /(?:获奖|award|荣誉).*?(\d+)/i,
                /(?:竞赛|competition|比赛).*?(\d+)/i,
                /(?:语言|language).*?(\d+)/i,
                /(?:证书|certificate).*?(\d+)/i,
                /(?:家庭|family|家属).*?(\d+)/i,
                /(?:论文|paper).*?(\d+)/i,
                /(?:专利|patent).*?(\d+)/i,
                /(?:会议|conference).*?(\d+)/i,
                /第([一二三四五六七八九十])(?:段|个|条)/,
                /#(\d+)/,
                /\((\d+)\)/,
                /\[(\d+)\]/
            ];
            
            for (const pattern of indexPatterns) {
                const match = text.match(pattern);
                if (match) {
                    let extractedIndex = match[1];
                    const chineseMap = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10};
                    if (chineseMap[extractedIndex]) {
                        extractedIndex = chineseMap[extractedIndex];
                    }
                    sectionIndex = parseInt(extractedIndex) - 1;
                    if (sectionIndex < 0) sectionIndex = 0;
                    break;
                }
            }

            // 上下文类型识别（按优先级排序，避免误判）
            // 注意：使用更精确的匹配，优先匹配完整短语，再匹配单个词
            
            // 基本信息（优先级提前，放在最前面）
            // 【优化】只排除明确的教育区块标题，使用完整短语匹配，避免误判
            // 【新增】增加更多基础信息区域的识别关键词
            if ((text.includes('基本') || text.includes('basic') || text.includes('个人信息') || text.includes('personal') || text.includes('contact') ||
                text.includes('个人资料') || text.includes('求职者信息') ||
                text.includes('账号信息') || text.includes('我的信息') ||
                text.includes('基本资料') || text.includes('个人简历')) &&
                // 排除"基本信息"中的"工作单位"等字段被误判
                !text.includes('工作经历') && !text.includes('work experience') &&
                // 【关键修改】只排除明确的教育区块标题，而不是所有包含教育关键词的情况
                !(text.includes('教育经历') || text.includes('教育背景') || 
                  (text.includes('education') && (text.includes('experience') || text.includes('background'))) ||
                  (text.includes('学历') && (text.includes('经历') || text.includes('背景'))))) {
                detectedContext = 'Basic Info';
                break;
            }
            
            // 专业成果子模块
            if (text.includes('论文') || text.includes('paper') || text.includes('发表') || text.includes('publication')) {
                detectedContext = 'Paper';
                break;
            }
            if (text.includes('专利') || text.includes('patent')) {
                detectedContext = 'Patent';
                break;
            }
            if ((text.includes('会议') && (text.includes('学术') || text.includes('conference'))) || text.includes('演讲')) {
                detectedContext = 'Conference';
                break;
            }
            
            // 社会实践子模块
            if (text.includes('志愿') || text.includes('volunteer') || text.includes('公益') || text.includes('义工')) {
                detectedContext = 'Volunteer';
                break;
            }
            if ((text.includes('社会') && text.includes('实践')) || text.includes('social practice')) {
                detectedContext = 'Social Project';
                break;
            }
            
            // 在校经历子模块
            if (text.includes('学生干部') || text.includes('职务') || text.includes('student leader') || text.includes('干部')) {
                detectedContext = 'Campus Leader';
                break;
            }
            if ((text.includes('校园') && text.includes('活动')) || text.includes('campus activity')) {
                detectedContext = 'Campus Activity';
                break;
            }
            
            // 主要维度
            if (text.includes('竞赛') || text.includes('competition') || text.includes('比赛') || text.includes('contest')) {
                detectedContext = 'Competition';
                break;
            }
            
            if (text.includes('证书') || text.includes('certificate') || text.includes('资格') || text.includes('执照')) {
                detectedContext = 'Certificate';
                break;
            }
            
            if (text.includes('家庭') || text.includes('family') || text.includes('家属') || text.includes('亲属')) {
                detectedContext = 'Family';
                break;
            }
            
            // 教育经历（排除"教育行业"）
            if (text.includes('教育') || text.includes('education') || text.includes('学校') || text.includes('school') || text.includes('学历') || text.includes('degree')) {
                if (!text.includes('行业') && !text.includes('industry')) {
                    detectedContext = 'Education';
                    break;
                }
            }
            
            // 实习经历
            if (text.includes('实习') || text.includes('intern')) {
                detectedContext = 'Work/Internship';
                break;
            }
            
            // 工作经历（优先匹配完整短语）
            if (text.includes('工作经历') || text.includes('work experience') || text.includes('职业经历') || text.includes('career')) {
                detectedContext = 'Work Experience';
                break;
            }
            
            // 一般工作/经历（排除"工作单位"、"工作内容"、"工作职责"）
            if (text.includes('工作') || text.includes('work') || text.includes('experience') || text.includes('职位') || text.includes('position')) {
                // 排除特定短语，避免误判
                if (!text.includes('工作单位') && !text.includes('工作内容') && !text.includes('工作职责') && 
                    !text.includes('work unit') && !text.includes('work content') && !text.includes('work duty')) {
                    detectedContext = 'Work/Internship';
                    break;
                }
            }

            if (text.includes('项目') || text.includes('project')) {
                detectedContext = 'Project';
                break;
            }

            if (text.includes('获奖') || text.includes('奖') || text.includes('award') || text.includes('荣誉') || text.includes('honor')) {
                detectedContext = 'Award';
                break;
            }

            if (text.includes('语言') || text.includes('language') || text.includes('英语') || text.includes('外语')) {
                detectedContext = 'Language';
                break;
            }
            
            if (text.includes('技能') || text.includes('skill') || text.includes('能力')) {
                detectedContext = 'Skill';
                break;
            }
            
            if (text.includes('自我评价') || text.includes('自我介绍') || text.includes('个人简介') || text.includes('self') || text.includes('summary')) {
                detectedContext = 'Self Evaluation';
                break;
            }
            
            if (text.includes('特殊说明') || text.includes('备注') || text.includes('其他') || text.includes('special') || text.includes('notes')) {
                detectedContext = 'Special Notes';
                break;
            }

                current = current.parentElement;
                depth++;
            }
            
            const result = {
                context: detectedContext,
                index: sectionIndex
            };
            
            // 缓存结果
            contextCache.set(element, result);
            return result;
        } catch (error) {
            console.error('[上下文检测] 检测上下文时出错:', error, element);
            return {
                context: 'Unknown',
                index: 0
            };
        }
    }

    // --- 工具: 清理标签文本 ---
    /**
     * 清理标签文本，去除标记和多余字符
     * @param {string} text - 原始标签文本
     * @returns {string} 清理后的标签文本
     */
    function cleanLabelText(text) {
        if (!text) return '';
        return text
            .replace(/（必填）/g, '')
            .replace(/（选填）/g, '')
            .replace(/\(必填\)/g, '')
            .replace(/\(选填\)/g, '')
            .replace(/\*/g, '')
            .replace(/[：:]/g, '')
            .trim();
    }

    // --- 工具: 获取标签文本（增强版，带缓存）---
    // 使用 WeakMap 缓存标签文本
    const labelCache = new WeakMap();
    
    /**
     * 获取元素的标签文本，使用多种策略
     * @param {HTMLElement} el - 目标元素
     * @returns {string} 标签文本
     */
    function getLabelText(el) {
        try {
            // 检查缓存
            if (labelCache.has(el)) {
                return labelCache.get(el);
            }
            
            let labelText = '';
            
            // 方法1: 通过 label[for] 关联（优先级最高）
            if (el.id) {
                const label = document.querySelector(`label[for="${el.id}"]`);
                if (label) {
                    labelText = (label.textContent || '').trim();
                    if (labelText) {
                        labelText = cleanLabelText(labelText);
                        if (labelText) {
                            labelCache.set(el, labelText);
                            return labelText;
                        }
                    }
                }
            }
            
            // 方法2: 查找父元素中的 label
            if (!labelText) {
                let parent = el.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                    const label = parent.querySelector('label');
                    if (label) {
                        labelText = (label.textContent || '').trim();
                        if (labelText && labelText.length < 100) {
                            labelText = cleanLabelText(labelText);
                            if (labelText) {
                                labelCache.set(el, labelText);
                                return labelText;
                            }
                        }
                    }
                    parent = parent.parentElement;
                }
            }
            
            // 方法3: 从 data-label 属性获取（提高优先级）
            if (!labelText) {
                labelText = el.getAttribute('data-label');
                if (labelText) {
                    labelText = cleanLabelText(labelText);
                    if (labelText) {
                        labelCache.set(el, labelText);
                        return labelText;
                    }
                }
            }
            
            // 方法4: 从其他属性中获取
            if (!labelText) {
                labelText = el.getAttribute('aria-label') || 
                           el.getAttribute('placeholder') || 
                           el.getAttribute('name') || 
                           el.getAttribute('title') || 
                           '';
                if (labelText) {
                    labelText = cleanLabelText(labelText);
                    if (labelText) {
                        labelCache.set(el, labelText);
                        return labelText;
                    }
                }
            }
            
            // 方法5: 检查前后兄弟文本节点
            if (!labelText) {
                // 检查前一个兄弟文本节点
                let sibling = el.previousSibling;
                while (sibling) {
                    if (sibling.nodeType === 3) { // 文本节点
                        const text = sibling.textContent.trim();
                        if (text && text.length > 0 && text.length < 50) {
                            labelText = cleanLabelText(text);
                            if (labelText) {
                                labelCache.set(el, labelText);
                                return labelText;
                            }
                        }
                    }
                    sibling = sibling.previousSibling;
                }
                
                // 检查后一个兄弟文本节点
                sibling = el.nextSibling;
                if (sibling && sibling.nodeType === 3) {
                    const text = sibling.textContent.trim();
                    if (text && text.length > 0 && text.length < 50) {
                        labelText = cleanLabelText(text);
                        if (labelText) {
                            labelCache.set(el, labelText);
                            return labelText;
                        }
                    }
                }
            }
            
            // 方法6: 检查前后兄弟元素
            if (!labelText) {
                // 检查前一个兄弟元素
                const prevElement = el.previousElementSibling;
                if (prevElement) {
                    const text = (prevElement.textContent || '').trim();
                    if (text && text.length > 0 && text.length < 50) {
                        labelText = cleanLabelText(text);
                        if (labelText) {
                            labelCache.set(el, labelText);
                            return labelText;
                        }
                    }
                }
                
                // 检查后一个兄弟元素
                const nextElement = el.nextElementSibling;
                if (nextElement) {
                    const text = (nextElement.textContent || '').trim();
                    if (text && text.length > 0 && text.length < 50) {
                        labelText = cleanLabelText(text);
                        if (labelText) {
                            labelCache.set(el, labelText);
                            return labelText;
                        }
                    }
                }
            }
            
            // 方法7: 从父元素文本中提取（最后手段）
            if (!labelText) {
                let parent = el.parentElement;
                for (let i = 0; i < 3 && parent; i++) {
                    const text = (parent.textContent || '').trim();
                    if (text && text.length > 0 && text.length < 80) {
                        if (!text.includes(el.value)) {
                            labelText = cleanLabelText(text);
                            if (labelText) {
                                labelCache.set(el, labelText);
                                return labelText;
                            }
                        }
                    }
                    parent = parent.parentElement;
                }
            }
            
            // 缓存空结果
            labelCache.set(el, '');
            return '';
        } catch (error) {
            console.error('[标签获取] 获取标签时出错:', error, el);
            return '';
        }
    }

    // --- 扫描页面（支持所有新维度，增强标签获取）---
    function scanPageForms() {
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        const formFields = [];
        const errors = [];
        const stats = {
            total: 0,
            success: 0,
            failed: 0,
            noLabel: 0,
            unknownContext: 0
        };

        // 【修改】统一的分段计数器结构，与 content.js 保持一致
        const sectionIndexCounters = {};

        inputs.forEach((el, index) => {
            try {
                if(el.disabled || el.style.display === 'none' || el.offsetParent === null) return;
                
                stats.total++;
                
                // 获取标签文本（使用新的函数）
                let labelText = getLabelText(el);
                
                // 【新增】如果 labelText 为空，尝试更多兑底策略
                if (!labelText) {
                    // 尝试从 placeholder 获取
                    labelText = el.getAttribute('placeholder') || '';
                    if (!labelText) {
                        // 尝试从 name 属性获取
                        labelText = el.getAttribute('name') || '';
                    }
                    if (!labelText) {
                        // 尝试从父级标题获取
                        let parent = el.parentElement;
                        for (let i = 0; i < 3 && parent && !labelText; i++) {
                            const header = parent.querySelector('h1, h2, h3, h4, h5, h6, .title, .header, strong');
                            if (header) {
                                const headerText = (header.textContent || '').trim();
                                if (headerText && headerText.length < 50) {
                                    labelText = headerText;
                                    break;
                                }
                            }
                            parent = parent.parentElement;
                        }
                    }
                }
                
                if (!labelText) {
                    stats.noLabel++;
                    console.warn(`[扫描字段] 字段 ${index} 未找到标签`);
                }

                // 获取下拉选项
                let options = [];
                if(el.tagName === 'SELECT') {
                    options = Array.from(el.options).slice(0, 25).map(o => ({text: o.text.trim(), value: o.value}));
                }

                // 生成稳定的唯一ID（任务1：改进字段ID生成策略）
                let uniqueId = '';
                try {
                    // 1. 优先使用元素的 id 或 name 属性
                    if (el.id) {
                        uniqueId = el.id;
                    } else if (el.name) {
                        uniqueId = el.name;
                    } else {
                        // 2. 生成基于元素位置路径的稳定ID
                        const elementPath = getElementPath(el);
                        if (elementPath) {
                            // 使用路径生成ID
                            const pathHash = simpleHash(elementPath);
                            uniqueId = `ai_path_${pathHash}`;
                        } else {
                            // 3. 如果路径生成失败，使用上下文+索引+标签的哈希ID
                            const contextInfo = detectSectionContext(el);
                            const contextType = contextInfo.context;
                            const hashInput = `${contextType}_${index}_${el.tagName}_${labelText}`;
                            const hash = simpleHash(hashInput);
                            uniqueId = `ai_hash_${hash}`;
                        }
                    }
                    
                    // 将生成的ID同时设置到 data-ai-id 和 data-ai-stable-id 属性上
                    if (!el.id) {
                        el.setAttribute('data-ai-id', uniqueId);
                    }
                    el.setAttribute('data-ai-stable-id', uniqueId);
                } catch (error) {
                    console.error(`[字段ID生成] 生成ID时出错:`, error, el);
                    uniqueId = `ai_gen_${index}`;
                    el.setAttribute('data-ai-id', uniqueId);
                }

                // 获取上下文和索引
                let contextInfo = detectSectionContext(el, labelText);
                let contextType = contextInfo.context;
                let sectionIndex = contextInfo.index;
                
                if (contextType === 'Unknown') {
                    stats.unknownContext++;
                    console.warn(`[扫描字段] 字段 ${index} 上下文未知`);
                }

                // 【修改】统一多段索引推断逻辑，与 content.js 保持一致
                if (multiSectionContexts.includes(contextType)) {
                    // 如果父容器已经明确指定了索引（>0），直接使用
                    if (sectionIndex > 0) {
                        // 更新计数器
                        if (!sectionIndexCounters[contextType]) {
                            sectionIndexCounters[contextType] = { currentIndex: sectionIndex, hasSeenKeyField: true };
                        } else if (sectionIndexCounters[contextType].currentIndex < sectionIndex) {
                            sectionIndexCounters[contextType].currentIndex = sectionIndex;
                            sectionIndexCounters[contextType].hasSeenKeyField = true;
                        }
                    } else {
                        // 索引为0，需要通过扫描顺序和关键字段推断
                        const isKeyField = keyFieldPatterns.test(labelText);
                        
                        if (!sectionIndexCounters[contextType]) {
                            // 第一次遇到这个类型
                            sectionIndexCounters[contextType] = { currentIndex: 0, hasSeenKeyField: isKeyField };
                            sectionIndex = 0;
                        } else {
                            // 已经处理过这个类型的字段
                            if (isKeyField && sectionIndexCounters[contextType].hasSeenKeyField) {
                                // 遇到新的关键字段，说明进入下一段
                                sectionIndexCounters[contextType].currentIndex++;
                                sectionIndexCounters[contextType].hasSeenKeyField = true;
                                sectionIndex = sectionIndexCounters[contextType].currentIndex;
                            } else {
                                // 使用当前段落索引
                                sectionIndex = sectionIndexCounters[contextType].currentIndex;
                                if (isKeyField) {
                                    sectionIndexCounters[contextType].hasSeenKeyField = true;
                                }
                            }
                        }
                    }
                }
                
                // 【新增】调试日志
                console.log(`[Context] label="${labelText}", context=${contextType}, index=${sectionIndex}`);

                formFields.push({
                    id: uniqueId,
                    type: el.tagName === 'SELECT' ? 'select' : el.type,
                    label: labelText.replace(/\s+/g, ' ').trim(),
                    context: contextType,
                    sectionIndex: sectionIndex,
                    placeholder: el.placeholder || '',
                    options: options.length ? options : undefined
                });
                
                stats.success++;
            } catch (error) {
                stats.failed++;
                const errorInfo = {
                    index: index,
                    element: el,
                    error: error.message || 'UNKNOWN_ERROR',
                    stack: error.stack
                };
                errors.push(errorInfo);
                console.error(`[扫描字段] 处理字段 ${index} 时出错:`, error, el);
            }
        });
        
        console.log('[扫描完成] 检测到的字段分组:', sectionIndexCounters);
        console.log('[扫描统计]', stats);
        if (errors.length > 0) {
            console.warn('[扫描错误]', errors);
        }
        
        return {
            fields: formFields,
            stats: stats,
            errors: errors
        };
    }

    // --- 工具: 等待元素出现（新增）---
    /**
     * 等待元素出现（对于动态加载的页面）
     * @param {string} fieldId - 字段ID
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {Promise<{element: HTMLElement|null, found: boolean, error: string|null}>}
     */
    async function waitForElement(fieldId, timeout = 2000) {
        const start = Date.now();
        const pollInterval = 100;
        
        while (Date.now() - start < timeout) {
            // 尝试所有查找策略
            const strategies = [
                () => document.getElementById(fieldId),
                () => document.querySelector(`[name="${fieldId}"]`),
                () => document.querySelector(`[data-ai-id="${fieldId}"]`),
                () => document.querySelector(`[data-ai-stable-id="${fieldId}"]`)
            ];
            
            for (const strategy of strategies) {
                try {
                    const el = strategy();
                    if (el && el.offsetParent !== null) { // 确保元素可见
                        return { element: el, found: true, error: null };
                    }
                } catch (e) {
                    // 继续尝试下一个策略
                }
            }
            
            await new Promise(r => setTimeout(r, pollInterval));
        }
        
        return { element: null, found: false, error: 'ELEMENT_NOT_FOUND' };
    }

    // --- 工具: 查找元素（任务4：增强元素查找，新增等待机制）---
    /**
     * 使用多种策略查找元素，如果找不到则等待元素出现
     * @param {string} fieldId - 字段ID
     * @param {boolean} waitIfNotFound - 如果找不到是否等待（默认true）
     * @returns {Promise<{element: HTMLElement|null, found: boolean, error: string|null}>} 查找结果
     */
    async function findElementByFieldId(fieldId, waitIfNotFound = true) {
        try {
            // 策略1: getElementById
            let el = document.getElementById(fieldId);
            if (el && el.offsetParent !== null) {
                return { element: el, found: true, error: null };
            }
            
            // 策略2: querySelector by name
            el = document.querySelector(`[name="${fieldId}"]`);
            if (el && el.offsetParent !== null) {
                return { element: el, found: true, error: null };
            }
            
            // 策略3: querySelector by data-ai-id
            el = document.querySelector(`[data-ai-id="${fieldId}"]`);
            if (el && el.offsetParent !== null) {
                return { element: el, found: true, error: null };
            }
            
            // 策略4: querySelector by data-ai-stable-id
            el = document.querySelector(`[data-ai-stable-id="${fieldId}"]`);
            if (el && el.offsetParent !== null) {
                return { element: el, found: true, error: null };
            }
            
            // 策略5: 如果找不到且允许等待，则等待元素出现
            if (waitIfNotFound) {
                return await waitForElement(fieldId, 2000);
            }
            
            // 所有策略都失败
            return { element: null, found: false, error: 'ELEMENT_NOT_FOUND' };
        } catch (error) {
            return { element: null, found: false, error: error.message || 'SEARCH_ERROR' };
        }
    }

    // --- 工具: 值匹配判断（改进版，更宽松的匹配逻辑）---
    /**
     * 判断实际值是否与期望值匹配（支持多种匹配方式）
     * @param {any} actual - 实际值
     * @param {any} expected - 期望值
     * @returns {boolean} 是否匹配
     */
    function isValueMatch(actual, expected) {
        const actualStr = String(actual).trim();
        const expectedStr = String(expected).trim();
        
        // 完全匹配
        if (actualStr === expectedStr) return true;
        
        // 包含匹配（双向）
        if (actualStr.includes(expectedStr) || expectedStr.includes(actualStr)) return true;
        
        // 去除空格和标点后匹配
        const cleanActual = actualStr.replace(/[\s\-_\(\)（）【】\[\]：:、，。]+/g, '');
        const cleanExpected = expectedStr.replace(/[\s\-_\(\)（）【】\[\]：:、，。]+/g, '');
        if (cleanActual === cleanExpected) return true;
        if (cleanActual.includes(cleanExpected) || cleanExpected.includes(cleanActual)) return true;
        
        return false;
    }

    // --- 工具: 验证填充结果（改进版，支持多次验证）---
    /**
     * 验证填充是否成功，支持多次尝试
     * @param {HTMLElement} element - 目标元素
     * @param {any} expectedValue - 期望值
     * @param {number} maxAttempts - 最大尝试次数（默认5次）
     * @param {number} interval - 每次尝试间隔（毫秒，默认200ms）
     * @returns {Promise<boolean>} 是否验证成功
     */
    async function validateFill(element, expectedValue, maxAttempts = 5, interval = 200) {
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise(r => setTimeout(r, interval));
            
            let actualValue;
            if (element.tagName === 'SELECT') {
                // 对于下拉框，检查选中的选项
                const selectedOption = element.options[element.selectedIndex];
                actualValue = selectedOption ? (selectedOption.value || selectedOption.text) : '';
            } else {
                actualValue = element.value || '';
            }
            
            if (isValueMatch(actualValue, expectedValue)) {
                return true;
            }
        }
        return false;
    }

    // --- 工具: 判断是否应该跳过字段（改进版，区分默认值和用户输入）---
    /**
     * 判断字段是否应该跳过（改进版，区分默认值和用户输入）
     * @param {HTMLElement} element - 目标元素
     * @returns {boolean} 是否应该跳过
     */
    function shouldSkipField(element) {
        // 检查是否是占位符
        if (element.placeholder && element.value === element.placeholder) {
            return false; // 占位符不算已有内容
        }
        
        // 检查是否是默认值
        const defaultValue = element.defaultValue || element.getAttribute('data-default-value');
        if (element.value === defaultValue) {
            return false; // 默认值不算已有内容
        }
        
        // 对于下拉框，检查是否是默认选项
        if (element.tagName === 'SELECT') {
            const defaultValues = ['0', '-1', ''];
            const defaultTexts = ['请选择', '请选择...', 'Select', '--', '--请选择--', '请选择...', '请选择', '未选择'];
            const selectedOption = element.options[element.selectedIndex];
            const selectedText = selectedOption ? selectedOption.text.trim() : '';
            
            if (defaultValues.includes(element.value)) {
                return false; // 默认值不算已有内容
            }
            if (defaultTexts.includes(selectedText)) {
                return false; // 默认选项文本不算已有内容
            }
            
            // 如果值是空字符串或只有空白字符，不算已有内容
            if (!element.value || element.value.trim() === '') {
                return false;
            }
        }
        
        // 对于普通输入框，检查是否为空或只有空白字符
        if (element.type !== 'checkbox' && element.type !== 'radio' && element.tagName !== 'SELECT') {
            if (!element.value || element.value.trim() === '') {
                return false; // 空值不算已有内容
            }
        }
        
        // 其他情况，按原逻辑判断（有值则跳过）
        return !!(element.value && element.value.trim() !== "");
    }

    // --- 填充逻辑（任务4：增强错误处理和验证，改进版）---
    async function applyAiMapping(mapping) {
        const errors = [];
        const stats = {
            total: 0,
            success: 0,
            failed: 0,
            skipped: 0,
            validationFailed: 0
        };
        
        for (const [fieldId, value] of Object.entries(mapping)) {
            try {
                if (value === null || value === undefined || value === "") continue;
                
                stats.total++;
                
                // 使用新的查找函数（支持等待）
                const searchResult = await findElementByFieldId(fieldId, true);
                
                if (!searchResult.found) {
                    const errorInfo = {
                        fieldId: fieldId,
                        error: searchResult.error || 'ELEMENT_NOT_FOUND',
                        message: `无法找到字段: ${fieldId}`
                    };
                    errors.push(errorInfo);
                    stats.failed++;
                    console.error(`[填充失败] ${errorInfo.message}`);
                    continue;
                }
                
                const el = searchResult.element;
                
                // 【修改】对 Basic Info 字段提供更宽松的保护策略
                const contextInfo = detectSectionContext(el);
                const isBasicInfo = contextInfo.context === 'Basic Info';
                
                // 改进的保护逻辑：区分默认值和用户输入
                const shouldSkip = shouldSkipField(el);
                
                if (shouldSkip) {
                    // 【新增】对于 Basic Info 字段，即使有值也允许覆盖
                    if (isBasicInfo) {
                        console.log(`[Basic Info Override] 字段 ${fieldId} 属于基础信息，允许覆盖已有值: ${el.value}`);
                        // 不跳过，继续填充
                    } else {
                        console.log(`[Skip] 跳过字段 ${fieldId}，已有内容`);
                        stats.skipped++;
                        continue;
                    }
                }

                if ((el.type === 'checkbox' || el.type === 'radio') && el.checked) {
                    console.log(`[Skip] 跳过选项 ${fieldId}，已勾选`);
                    stats.skipped++;
                    continue;
                }

                console.log(`[填充] ${fieldId} =`, value);
                
                if (el.tagName === 'SELECT') {
                    const match = findSelectOption(el, value);
                    if (match) {
                        // 尝试多种设置方式
                        try {
                            el.selectedIndex = match.index;
                        } catch (e) {
                            // 如果设置索引失败，尝试设置value
                            try {
                                el.value = match.option.value;
                            } catch (e2) {
                                console.warn(`[下拉框设置] 无法设置下拉框 ${fieldId}，尝试直接操作选项`);
                            }
                        }
                        
                        // 触发完整的事件序列
                        el.dispatchEvent(new Event('focus', { bubbles: true, cancelable: true }));
                        el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                        el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        
                        // 使用改进的验证逻辑（多次验证）
                        const expectedValue = match.option.value || match.option.text;
                        const isValid = await validateFill(el, expectedValue, 5, 200);
                        
                        if (isValid) {
                            stats.success++;
                            console.log(`[填充成功] 下拉框 ${fieldId} 已设置为: ${expectedValue}`);
                        } else {
                            const errorInfo = {
                                fieldId: fieldId,
                                error: 'VALIDATION_FAILED',
                                message: `下拉框 ${fieldId} 填充后验证失败，期望值 "${expectedValue}"`
                            };
                            errors.push(errorInfo);
                            stats.validationFailed++;
                            console.error(`[验证失败] ${errorInfo.message}`);
                        }
                    } else {
                        const errorInfo = {
                            fieldId: fieldId,
                            error: 'OPTION_NOT_FOUND',
                            message: `下拉框 ${fieldId} 中未找到匹配选项: ${value}`
                        };
                        errors.push(errorInfo);
                        stats.failed++;
                        console.error(`[填充失败] ${errorInfo.message}`);
                    }
                } else {
                    setNativeValue(el, value);
                    
                    // 使用改进的验证逻辑（多次验证）
                    const expectedValue = String(value);
                    const isValid = await validateFill(el, expectedValue, 5, 200);
                    
                    if (isValid) {
                        stats.success++;
                        const actualValue = el.value || '';
                        console.log(`[填充成功] 字段 ${fieldId} 已设置为: ${actualValue}`);
                    } else {
                        const actualValue = el.value || '';
                        const errorInfo = {
                            fieldId: fieldId,
                            error: 'VALIDATION_FAILED',
                            message: `字段 ${fieldId} 填充后验证失败，期望值 "${expectedValue}"，实际值 "${actualValue}"`
                        };
                        errors.push(errorInfo);
                        stats.validationFailed++;
                        console.error(`[验证失败] ${errorInfo.message}`);
                    }
                }
            } catch (error) {
                const errorInfo = {
                    fieldId: fieldId,
                    error: error.message || 'UNKNOWN_ERROR',
                    message: `填充字段 ${fieldId} 时发生错误: ${error.message}`,
                    stack: error.stack
                };
                errors.push(errorInfo);
                stats.failed++;
                console.error(`[填充错误] ${errorInfo.message}`, error);
            }
        }
        
        console.log('[填充统计]', stats);
        if (errors.length > 0) {
            console.warn('[填充错误]', errors);
        }
        
        return {
            count: stats.success,
            errors: errors,
            stats: stats
        };
    }

    // --- 消息监听 ---
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        try {
            if (msg.action === 'EXPAND_FORM') {
                expandFormSections(msg.counts).then(() => sendResponse({ done: true })).catch(error => {
                    console.error('[扩展表单] 错误:', error);
                    sendResponse({ done: false, error: error.message });
                });
                return true;
            } 
            else if (msg.action === 'SCAN_FORM') {
                const result = scanPageForms();
                // 保持向后兼容：如果调用方期望 fields 数组，也提供
                sendResponse({ 
                    fields: result.fields,
                    stats: result.stats,
                    errors: result.errors
                });
            } 
            else if (msg.action === 'APPLY_MAPPING') {
                // applyAiMapping 现在是异步函数，需要等待结果
                applyAiMapping(msg.mapping).then(result => {
                    // 保持向后兼容：如果调用方期望 count 数字，也提供
                    sendResponse({ 
                        count: result.count,
                        errors: result.errors,
                        stats: result.stats
                    });
                }).catch(error => {
                    console.error('[应用映射] 错误:', error);
                    sendResponse({ 
                        count: 0,
                        errors: [{ error: error.message || 'UNKNOWN_ERROR', message: error.message }],
                        stats: { total: 0, success: 0, failed: 1, skipped: 0, validationFailed: 0 }
                    });
                });
                return true; // 保持消息通道开放
            }
        } catch (error) {
            console.error('[消息处理] 处理消息时出错:', error, msg);
            sendResponse({ error: error.message || 'UNKNOWN_ERROR' });
        }
    });

})();
