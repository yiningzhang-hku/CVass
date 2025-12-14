/* START OF FILE content_script.js */

(function() {
    if (window.__JOB_AUTOFILL_AI_INSTALLED__) return;
    window.__JOB_AUTOFILL_AI_INSTALLED__ = true;

    // --- 工具: React 兼容赋值 ---
    function setNativeValue(element, value) {
        const lastValue = element.value;
        element.value = value;
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value');
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (prototypeValueSetter && prototypeValueSetter.set && prototypeValueSetter.set !== valueSetter?.set) {
            prototypeValueSetter.set.call(element, value);
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    // --- 自动扩展表单 (保持不变) ---
    async function expandFormSections(counts) {
        // ... (保持之前的代码不变，为了节省篇幅这里省略，请保留之前的 expandFormSections 逻辑) ...
        // 如果您丢失了这段代码，请告诉我，我再发一遍。核心逻辑是点击 Add 按钮。
        console.log("JobAutoFill: 开始扩展表单...", counts);
        const keywords = {
            education: ['添加教育', 'Add Education', '增加教育', 'Add Another Education', '添加', 'Add'], 
            work: ['添加工作', 'Add Work', 'Add Experience', '增加工作', '实习', '添加', 'Add'],
            project: ['添加项目', 'Add Project', '增加项目', '添加', 'Add'],
            award: ['添加获奖', 'Add Award', '增加获奖', '证书', 'Honor', '添加', 'Add'],
            language: ['添加语言', 'Add Language', '增加语言', '外语', '添加', 'Add']
        };
        function findAddButton(sectionKeywords) {
            const candidates = document.querySelectorAll('button, a, div[role="button"], span.add-btn, i');
            for (let el of candidates) {
                if (el.offsetParent === null) continue;
                const text = (el.innerText || el.textContent || "").trim().toLowerCase();
                const match = sectionKeywords.some(k => text.includes(k.toLowerCase()));
                if (match) return el;
            }
            return null;
        }
        async function processSection(type, userCount) {
            if (userCount <= 1) return; 
            let btn = findAddButton(keywords[type]);
            if (btn) {
                const clicksNeeded = Math.min(userCount - 1, 5);
                for (let i = 0; i < clicksNeeded; i++) {
                    btn.click();
                    await new Promise(r => setTimeout(r, 800)); 
                }
            }
        }
        await processSection('education', counts.education);
        await processSection('work', counts.work);
        await processSection('project', counts.project);
        await processSection('award', counts.award);
        await processSection('language', counts.language);
    }

    // --- 核心修改：更智能的上下文识别 ---
    function detectSectionContext(element) {
        let current = element.parentElement;
        let depth = 0;
        const maxDepth = 8; // 稍微增加深度

        while (current && depth < maxDepth) {
            // 1. 获取当前容器的文本，但排除掉输入框自身和子元素的大段文本
            // 我们主要找 Heading 标签或明显的 Title Class
            const headerCandidates = current.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, .title, .header, strong, span.section-label');
            
            let foundText = "";
            // 如果父级本身就很短（可能是个label wrapper），直接取文本
            if (current.innerText.length < 100) {
                foundText = current.innerText;
            } else {
                // 如果父级很大，只看它内部的标题元素
                headerCandidates.forEach(h => foundText += " " + h.innerText);
            }
            
            const text = foundText.toLowerCase();

            // 2. 优先级判定 (一旦匹配到强特征，立刻返回，防止继续向上找到错误的父级)
            
            // 教育经历
            if (text.includes('教育') || text.includes('education') || text.includes('学校') || text.includes('school') || text.includes('学历') || text.includes('degree')) {
                // 排除掉 "教育行业" 这种出现在工作描述里的词
                if (!text.includes('行业') && !text.includes('industry')) return 'Context: Education';
            }
            
            // 工作/实习
            if (text.includes('工作') || text.includes('work') || text.includes('实习') || text.includes('intern') || text.includes('experience') || text.includes('career') || text.includes('职位') || text.includes('position')) {
                return 'Context: Work/Internship';
            }

            // 项目
            if (text.includes('项目') || text.includes('project')) {
                return 'Context: Project';
            }

            // 获奖
            if (text.includes('奖') || text.includes('award') || text.includes('证书') || text.includes('certificate') || text.includes('honor')) {
                return 'Context: Award';
            }

            // 语言
            if (text.includes('语言') || text.includes('language') || text.includes('英语') || text.includes('english')) {
                return 'Context: Language';
            }
            
            // 基本信息 (优先级最低，防止误判)
            if (text.includes('基本') || text.includes('basic') || text.includes('个人') || text.includes('personal') || text.includes('contact')) {
                return 'Context: Basic Info';
            }

            current = current.parentElement;
            depth++;
        }
        return 'Context: Unknown'; // 没找到明确标识
    }

    // --- 扫描页面 ---
    function scanPageForms() {
        const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
        const formFields = [];

        inputs.forEach((el, index) => {
            if(el.disabled || el.style.display === 'none' || el.offsetParent === null) return;
            
            let labelText = '';
            if (el.id) {
                const label = document.querySelector(`label[for="${el.id}"]`);
                if (label) labelText = label.innerText;
            }
            if (!labelText) labelText = el.getAttribute('aria-label') || '';
            if (!labelText) labelText = el.placeholder || ''; // 增加 placeholder 作为 label 参考
            if (!labelText) {
                let p = el.parentElement;
                if(p && p.innerText.length < 50) labelText = p.innerText;
            }

            let options = [];
            if(el.tagName === 'SELECT') {
                options = Array.from(el.options).slice(0, 20).map(o => ({text: o.text.trim(), value: o.value}));
            }

            const uniqueId = el.id || el.name || `ai_gen_${index}`;
            if(!el.id && !el.name) el.setAttribute('data-ai-id', uniqueId);

            // 获取上下文
            const context = detectSectionContext(el);

            formFields.push({
                id: uniqueId,
                type: el.tagName === 'SELECT' ? 'select' : el.type,
                label: labelText.replace(/\s+/g, ' ').trim(),
                context: context, // 传递给 AI
                placeholder: el.placeholder || '',
                options: options.length ? options : undefined
            });
        });
        return formFields;
    }

     // --- 填充逻辑 ---
    function applyAiMapping(mapping) {
        let count = 0;
        for (const [fieldId, value] of Object.entries(mapping)) {
            // AI 返回的空值跳过
            if (value === null || value === undefined || value === "") continue;
            
            // 寻找元素
            let el = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`) || document.querySelector(`[data-ai-id="${fieldId}"]`);
            
            if (el) {
                // --- 新增保护逻辑：如果字段已有内容，则跳过 ---
                
                // 1. 对于文本框、文本域 (Text / Textarea / Date / Number etc.)
                // 检查 value 是否存在且不为空字符串
                if (el.type !== 'checkbox' && el.type !== 'radio' && el.tagName !== 'SELECT') {
                    if (el.value && el.value.trim() !== "") {
                        console.log(`[Skip] 跳过字段 ${fieldId}，因为已有内容: "${el.value}"`);
                        continue; 
                    }
                }

                // 2. 对于下拉框 (Select)
                // 这一步稍微复杂，因为有些下拉框默认选了 "请选择" (value可能是 "" 或 "0")
                // 这里我们采取保守策略：如果 value 存在且不为空，视为已选
                if (el.tagName === 'SELECT') {
                    if (el.value && el.value.trim() !== "" && el.value !== "0") {
                        // 额外检查：有些网站的默认选项 value 就是空字符串，那种情况算未填
                        console.log(`[Skip] 跳过下拉框 ${fieldId}，因为已选择: "${el.value}"`);
                        continue;
                    }
                }

                // 3. 对于单选/多选 (Radio / Checkbox)
                // 如果已经被勾选，则不修改
                if ((el.type === 'checkbox' || el.type === 'radio') && el.checked) {
                    console.log(`[Skip] 跳过选项 ${fieldId}，因为已被勾选`);
                    continue;
                }
                
                // ----------------------------------------------

                console.log(`Filling ${fieldId} with`, value);
                
                // 执行填充
                if (el.tagName === 'SELECT') {
                    const opts = Array.from(el.options);
                    // 优先匹配 value，其次匹配 text
                    let idx = opts.findIndex(o => o.value === value || o.text === value);
                    // 模糊匹配 text
                    if(idx === -1) idx = opts.findIndex(o => o.text.includes(value));
                    
                    if (idx !== -1) {
                        el.selectedIndex = idx;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                        count++;
                    }
                } else {
                    setNativeValue(el, value);
                    count++;
                }
            }
        }
        return count;
    }
    // --- 消息监听 ---
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'EXPAND_FORM') {
            expandFormSections(msg.counts).then(() => sendResponse({ done: true }));
            return true;
        } 
        else if (msg.action === 'SCAN_FORM') {
            const fields = scanPageForms();
            sendResponse({ fields: fields });
        } 
        else if (msg.action === 'APPLY_MAPPING') {
            const count = applyAiMapping(msg.mapping);
            sendResponse({ count: count });
        }
    });

})();