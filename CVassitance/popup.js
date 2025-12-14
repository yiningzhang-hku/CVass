/* START OF FILE popup.js */
document.addEventListener('DOMContentLoaded', () => {
    
    setupTabs();
    
    // 容器和模板
    const sections = ['education', 'work', 'project', 'award', 'language'];
    const containers = {};
    const templates = {};
    
    sections.forEach(type => {
        const shortKey = type === 'education' ? 'edu' : 
                         type === 'project' ? 'proj' : 
                         type === 'language' ? 'lang' : type;
        containers[type] = document.getElementById(`${shortKey}-list`);
        templates[type] = document.getElementById(`tpl-${shortKey}`);
        
        document.getElementById(`add-${shortKey}-btn`).addEventListener('click', () => addItem(type));
    });

    // 添加条目
    function addItem(type, data = {}) {
        const clone = templates[type].content.cloneNode(true);
        const itemDiv = clone.querySelector('.list-item');
        itemDiv.querySelectorAll('.field').forEach(input => {
            const key = input.dataset.key;
            if (data[key]) input.value = data[key];
        });
        itemDiv.querySelector('.remove-btn').addEventListener('click', () => itemDiv.remove());
        containers[type].appendChild(itemDiv);
    }

    // 加载数据
    chrome.storage.local.get(['profile', 'config'], (result) => {
        const p = result.profile || {};
        if(p.basic) {
            document.getElementById('basic-name').value = p.basic.name || '';
            document.getElementById('basic-phone').value = p.basic.phone || '';
            document.getElementById('basic-email').value = p.basic.email || '';
            document.getElementById('basic-gender').value = p.basic.gender || '';
            document.getElementById('basic-ethnicity').value = p.basic.ethnicity || '';
            document.getElementById('basic-nationality').value = p.basic.nationality || '';
        }

        sections.forEach(type => {
            const listData = p[type] || [];
            listData.forEach(d => addItem(type, d));
            if (!listData.length && (type === 'education' || type === 'work')) {
                addItem(type);
            }
        });

        if(result.config) {
            document.getElementById('api-key').value = result.config.apiKey || '';
            document.getElementById('api-model').value = result.config.model || 'deepseek-ai/DeepSeek-V3';
        }
    });

    // 保存数据
    document.getElementById('save-profile-btn').addEventListener('click', () => {
        const scrape = (type) => {
            const list = [];
            containers[type].querySelectorAll('.list-item').forEach(item => {
                const obj = {};
                let hasVal = false;
                item.querySelectorAll('.field').forEach(input => {
                    obj[input.dataset.key] = input.value.trim();
                    if(input.value.trim()) hasVal = true;
                });
                if(hasVal) list.push(obj);
            });
            return list;
        };

        const profile = {
            basic: {
                name: document.getElementById('basic-name').value.trim(),
                phone: document.getElementById('basic-phone').value.trim(),
                email: document.getElementById('basic-email').value.trim(),
                gender: document.getElementById('basic-gender').value.trim(),
                ethnicity: document.getElementById('basic-ethnicity').value.trim(),
                nationality: document.getElementById('basic-nationality').value.trim()
            },
            education: scrape('education'),
            work: scrape('work'),
            project: scrape('project'),
            award: scrape('award'),
            language: scrape('language')
        };

        chrome.storage.local.set({ profile }, () => {
            const btn = document.getElementById('save-profile-btn');
            const originalText = btn.textContent;
            btn.textContent = '✅ 已保存';
            setTimeout(() => btn.textContent = originalText, 1000);
        });
    });
    
    // 保存配置
    document.getElementById('save-config-btn').addEventListener('click', () => {
        const config = {
            apiKey: document.getElementById('api-key').value.trim(),
            model: document.getElementById('api-model').value
        };
        chrome.storage.local.set({ config }, () => alert('配置已保存'));
    });

    // AI 运行
    const aiFillBtn = document.getElementById('ai-fill-btn');
    aiFillBtn.addEventListener('click', async () => {
        const data = await chrome.storage.local.get(['profile', 'config']);
        if (!data.config?.apiKey) return alert('请先设置 API Key');
        
        runAiAutoFill(data.config, data.profile, aiFillBtn);
    });

    async function runAiAutoFill(config, profile, btn) {
        try {
            btn.disabled = true;
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            log('正在注入脚本...');
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content_script.js'] });

            btn.textContent = '🖱️ 扩展表单...';
            const counts = {
                education: profile.education?.length || 0,
                work: profile.work?.length || 0,
                project: profile.project?.length || 0,
                award: profile.award?.length || 0,
                language: profile.language?.length || 0
            };
            await chrome.tabs.sendMessage(tab.id, { action: 'EXPAND_FORM', counts: counts });
            
            btn.textContent = '👀 扫描字段...';
            const scanRes = await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_FORM' });
            log(`扫描到 ${scanRes.fields.length} 个字段`);

            btn.textContent = '🧠 AI 匹配中...';
            const mapping = await callDeepSeekAPI(config.apiKey, config.model, profile, scanRes.fields);
            
            btn.textContent = '✍️ 写入数据...';
            const fillRes = await chrome.tabs.sendMessage(tab.id, { action: 'APPLY_MAPPING', mapping });
            
            log(`✅ 成功填充 ${fillRes.count} 个字段`);
            btn.textContent = '✅ 完成';

        } catch (e) {
            log(`❌ 错误: ${e.message}`);
            console.error(e);
            btn.textContent = '❌ 出错';
        } finally {
            setTimeout(() => { 
                btn.disabled = false; 
                if(btn.textContent === '✅ 完成' || btn.textContent === '❌ 出错') btn.textContent = '🤖 开始智能填充';
            }, 3000);
        }
    }

    function log(msg) {
        const area = document.getElementById('log-area');
        const div = document.createElement('div');
        div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        area.appendChild(div);
        area.scrollTop = area.scrollHeight;
    }

    function setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            });
        });
    }

    /* 只需修改 callDeepSeekAPI 函数 */

    async function callDeepSeekAPI(apiKey, model, profile, formFields) {
        const systemPrompt = `你是一个精准的网页填表助手。你的核心任务是解决【数据错位】问题并进行【格式标准化】。
        
        输入：
        1. User Resume (JSON): 包含 education[], work[], project[] 等数组。
        2. Web Fields (JSON): 网页字段列表，包含 id, label, type, options, 和最重要的 **context**。

        必须严格遵守的【反错位与格式化规则】：

        1. **Context 绝对隔离（Context Firewall）**:
           - 网页字段的 'context' 决定了它的数据源。
           - Context = "Education" -> 只能填 resume.education。严禁填入 resume.work 的数据。
           - Context = "Work/Internship" -> 只能填 resume.work。
           - 如果 label 是 "Start Date"，必须先看 Context。如果是 Work Context，绝对不能填 Education 的日期。

        2. **分组与索引重置（Grouping & Index Reset）**:
           - 网页上的字段是平铺的，你需要在大脑中将它们按 Context 分组。
           - 当检测到 Context 从 "Education" 变为 "Work" 时，**数据索引必须重置为 0**。
           - 例子：
             - 网页字段 1-5 (Education): 填入 resume.education[0]
             - 网页字段 6-10 (Education): 填入 resume.education[1]
             - 网页字段 11-15 (Work): **填入 resume.work[0]** (注意：索引重置！)

        3. **智能识别组边界**:
           - 通常一组经历包含 "School/Company", "Time", "Description"。当再次遇到 "School/Company" 时，视为下一组 (index + 1)。

        4. **字段值处理**:
           - **日期格式**:  统一转为 "YYYY.M" (如 "2025.8")。如果网页有单独的月份输入框，**必须去除前导零** (如 "02" -> "2", "09" -> "9", "11" -> "11")。
           - **下拉框**: 返回匹配的 value 或 text。
           - **文本**: 直接填入内容。

        返回 JSON: { "field_id": "value" }
        `;

        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || "deepseek-ai/DeepSeek-V3",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify({ user_resume: profile, web_fields: formFields }) }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 4096
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const content = data.choices[0].message.content;

        // --- 新增：输出模型返回的原始内容 ---
        console.log("🤖 DeepSeek Raw Output:", content); // 在 F12 控制台打印
        
        log("------------------------");
        log("🤖 模型原始返回:");
        log(content); // 在插件弹窗界面打印
        log("------------------------");
        // -----------------------------------

        return JSON.parse(content);
    }
});