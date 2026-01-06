/* START OF FILE popup.js */
document.addEventListener('DOMContentLoaded', () => {
    
    setupTabs();
    
    // ========== 维度配置：定义所有sections及其shortKey映射 ==========
    const sectionConfig = {
        // 多条目维度 (需要add/remove按钮)
        education:       { shortKey: 'edu',            container: 'edu-list',            template: 'tpl-edu',            addBtn: 'add-edu-btn' },
        award:           { shortKey: 'award',          container: 'award-list',          template: 'tpl-award',          addBtn: 'add-award-btn' },
        competition:     { shortKey: 'competition',    container: 'competition-list',    template: 'tpl-competition',    addBtn: 'add-competition-btn' },
        project:         { shortKey: 'proj',           container: 'proj-list',           template: 'tpl-proj',           addBtn: 'add-proj-btn' },
        internship:      { shortKey: 'internship',     container: 'internship-list',     template: 'tpl-internship',     addBtn: 'add-internship-btn' },
        workExperience:  { shortKey: 'workExp',        container: 'workExp-list',        template: 'tpl-workExp',        addBtn: 'add-workExp-btn' },
        language:        { shortKey: 'lang',           container: 'lang-list',           template: 'tpl-lang',           addBtn: 'add-lang-btn' },
        certificate:     { shortKey: 'certificate',    container: 'certificate-list',    template: 'tpl-certificate',    addBtn: 'add-certificate-btn' },
        familyMembers:   { shortKey: 'family',         container: 'family-list',         template: 'tpl-family',         addBtn: 'add-family-btn' },
        // 在校经历子模块
        campusLeader:    { shortKey: 'campusLeader',   container: 'campusLeader-list',   template: 'tpl-campusLeader',   addBtn: 'add-campusLeader-btn' },
        campusActivity:  { shortKey: 'campusActivity', container: 'campusActivity-list', template: 'tpl-campusActivity', addBtn: 'add-campusActivity-btn' },
        // 社会实践子模块
        volunteer:       { shortKey: 'volunteer',      container: 'volunteer-list',      template: 'tpl-volunteer',      addBtn: 'add-volunteer-btn' },
        socialProject:   { shortKey: 'socialProject',  container: 'socialProject-list',  template: 'tpl-socialProject',  addBtn: 'add-socialProject-btn' },
        // 专业成果子模块
        paper:           { shortKey: 'paper',          container: 'paper-list',          template: 'tpl-paper',          addBtn: 'add-paper-btn' },
        patent:          { shortKey: 'patent',         container: 'patent-list',         template: 'tpl-patent',         addBtn: 'add-patent-btn' },
        conference:      { shortKey: 'conference',     container: 'conference-list',     template: 'tpl-conference',     addBtn: 'add-conference-btn' }
    };

    // 容器和模板引用
    const containers = {};
    const templates = {};
    
    // 初始化所有section
    Object.keys(sectionConfig).forEach(type => {
        const config = sectionConfig[type];
        containers[type] = document.getElementById(config.container);
        templates[type] = document.getElementById(config.template);
        
        const addBtn = document.getElementById(config.addBtn);
        if (addBtn) {
            addBtn.addEventListener('click', () => addItem(type));
        }
    });

    // ========== 日期格式化工具函数 ==========
    function formatMonthToYYYYM(monthValue) {
        // 将 "2025-08" 转换为 "2025.8"
        if (!monthValue) return '';
        const [year, month] = monthValue.split('-');
        if (!year || !month) return monthValue;
        return `${year}.${parseInt(month, 10)}`; // parseInt去除前导零
    }

    function parseYYYYMToMonth(value) {
        // 将 "2025.8" 转换为 "2025-08"
        if (!value) return '';
        const match = value.match(/^(\d{4})\.(\d{1,2})$/);
        if (match) {
            const [, year, month] = match;
            return `${year}-${month.padStart(2, '0')}`;
        }
        return value;
    }

    // ========== 添加条目 ==========
    function addItem(type, data = {}) {
        const template = templates[type];
        const container = containers[type];
        if (!template || !container) return;

        const clone = template.content.cloneNode(true);
        const itemDiv = clone.querySelector('.list-item');
        
        // 填充数据
        itemDiv.querySelectorAll('.field').forEach(input => {
            const key = input.dataset.key;
            if (data[key] !== undefined && data[key] !== null) {
                // 对于月份输入框，需要转换格式
                if (input.type === 'month') {
                    input.value = parseYYYYMToMonth(data[key]);
                } else {
                    input.value = data[key];
                }
            }
        });
        
        // 删除按钮事件
        const removeBtn = itemDiv.querySelector('.remove-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => itemDiv.remove());
        }
        
        container.appendChild(itemDiv);
    }

    // ========== 基本信息字段列表 ==========
    const basicFields = [
        'name', 'gender', 'phone', 'email', 'birthDate', 'ethnicity', 'nationality',
        'hometown', 'currentAddress', 'maritalStatus', 'politicalStatus', 'height', 'weight'
    ];

    // ========== 加载数据 ==========
    // 将加载逻辑抽离为函数，供初始加载和解析后处理复用
    function loadProfileData() {
        chrome.storage.local.get(['profile', 'config'], (result) => {
            const p = result.profile || {};
            renderProfileToForm(p);
            
            // 加载配置
            if (result.config) {
                document.getElementById('api-key').value = result.config.apiKey || '';
                document.getElementById('api-model').value = result.config.model || 'Qwen/Qwen2.5-72B-Instruct';
            }
        });
    }
    
    /**
     * 将 profile 对象渲染到表单 UI
     * @param {Object} profile - profile 对象
     */
    function renderProfileToForm(profile) {
        // 加载基本信息
        if (profile.basic) {
            basicFields.forEach(field => {
                const el = document.getElementById(`basic-${field}`);
                if (el && profile.basic[field] !== undefined) {
                    if (el.type === 'month') {
                        el.value = parseYYYYMToMonth(profile.basic[field]);
                    } else {
                        el.value = profile.basic[field];
                    }
                }
            });
        }

        // 清空并加载多条目数据（使用批量更新优化性能）
        // 先收集所有需要渲染的数据
        const renderTasks = [];
        Object.keys(sectionConfig).forEach(type => {
            const container = containers[type];
            if (!container) return;
            
            // 清空现有内容
            container.innerHTML = '';
            
            // 根据 type 获取对应的数据（处理嵌套结构）
            let listData = [];
            
            // 嵌套数组维度：特殊映射
            if (type === 'campusLeader') {
                listData = profile.campus?.leader || [];
            } else if (type === 'campusActivity') {
                listData = profile.campus?.activity || [];
            } else if (type === 'volunteer') {
                listData = profile.socialPractice?.volunteer || [];
            } else if (type === 'socialProject') {
                listData = profile.socialPractice?.project || [];
            } else if (type === 'paper') {
                listData = profile.professionalAchievement?.paper || [];
            } else if (type === 'patent') {
                listData = profile.professionalAchievement?.patent || [];
            } else if (type === 'conference') {
                listData = profile.professionalAchievement?.conference || [];
            } else {
                // 普通数组维度：直接读取
                listData = profile[type] || [];
            }
            
            // 为教育和实习默认添加一条空记录（仅在数据为空时）
            if (!listData.length && (type === 'education' || type === 'internship')) {
                listData = [{}];
            }
            
            // 收集渲染任务
            renderTasks.push({ type, listData, container });
        });
        
        // 批量渲染（使用 DocumentFragment 减少重排）
        renderTasks.forEach(({ type, listData, container }) => {
            const fragment = document.createDocumentFragment();
            listData.forEach(d => {
                const template = templates[type];
                if (!template) return;
                const clone = template.content.cloneNode(true);
                const itemDiv = clone.querySelector('.list-item');
                if (itemDiv) {
                    // 填充数据
                    itemDiv.querySelectorAll('.field').forEach(input => {
                        const key = input.dataset.key;
                        if (d[key] !== undefined && d[key] !== null) {
                            if (input.type === 'month') {
                                input.value = parseYYYYMToMonth(d[key]);
                            } else {
                                input.value = d[key];
                            }
                        }
                    });
                    
                    // 删除按钮事件
                    const removeBtn = itemDiv.querySelector('.remove-btn');
                    if (removeBtn) {
                        removeBtn.addEventListener('click', () => itemDiv.remove());
                    }
                    
                    fragment.appendChild(itemDiv);
                }
            });
            container.appendChild(fragment);
        });

        // 加载单字段维度
        if (profile.skill && profile.skill.description) {
            document.getElementById('skill-description').value = profile.skill.description;
        } else {
            document.getElementById('skill-description').value = '';
        }
        
        if (profile.selfEvaluation && profile.selfEvaluation.description) {
            document.getElementById('selfEvaluation-description').value = profile.selfEvaluation.description;
        } else {
            document.getElementById('selfEvaluation-description').value = '';
        }
        
        if (profile.specialNotes && profile.specialNotes.description) {
            document.getElementById('specialNotes-description').value = profile.specialNotes.description;
        } else {
            document.getElementById('specialNotes-description').value = '';
        }
    }
    
    // 初始加载
    loadProfileData();

    // ========== 收集字段数据 ==========
    function scrapeSection(type) {
        const container = containers[type];
        if (!container) return [];
        
        const list = [];
        container.querySelectorAll('.list-item').forEach(item => {
            const obj = {};
            let hasVal = false;
            item.querySelectorAll('.field').forEach(input => {
                let value = input.value.trim();
                // 月份格式转换
                if (input.type === 'month' && value) {
                    value = formatMonthToYYYYM(value);
                }
                obj[input.dataset.key] = value;
                if (value) hasVal = true;
            });
            if (hasVal) list.push(obj);
        });
        return list;
    }

    // ========== 保存数据 ==========
    document.getElementById('save-profile-btn').addEventListener('click', () => {
        console.log('📝 开始保存简历数据...');
        
        // 收集基本信息
        const basic = {};
        basicFields.forEach(field => {
            const el = document.getElementById(`basic-${field}`);
            if (el) {
                let value = el.value.trim();
                if (el.type === 'month' && value) {
                    value = formatMonthToYYYYM(value);
                }
                basic[field] = value;
            }
        });

        // 构建profile对象
        const profile = {
            basic: basic,
            // 多条目维度
            education: scrapeSection('education'),
            award: scrapeSection('award'),
            competition: scrapeSection('competition'),
            project: scrapeSection('project'),
            internship: scrapeSection('internship'),
            workExperience: scrapeSection('workExperience'),
            language: scrapeSection('language'),
            certificate: scrapeSection('certificate'),
            familyMembers: scrapeSection('familyMembers'),
            // 在校经历 (组合子模块)
            campus: {
                leader: scrapeSection('campusLeader'),
                activity: scrapeSection('campusActivity')
            },
            // 社会实践 (组合子模块)
            socialPractice: {
                volunteer: scrapeSection('volunteer'),
                project: scrapeSection('socialProject')
            },
            // 专业成果 (组合子模块)
            professionalAchievement: {
                paper: scrapeSection('paper'),
                patent: scrapeSection('patent'),
                conference: scrapeSection('conference')
            },
            // 单字段维度
            skill: {
                description: document.getElementById('skill-description').value.trim()
            },
            selfEvaluation: {
                description: document.getElementById('selfEvaluation-description').value.trim()
            },
            specialNotes: {
                description: document.getElementById('specialNotes-description').value.trim()
            }
        };

        console.log('💾 准备保存的数据:', profile);

        chrome.storage.local.set({ profile }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ 保存失败:', chrome.runtime.lastError);
                alert('保存失败: ' + chrome.runtime.lastError.message);
                return;
            }
            
            console.log('✅ 数据保存成功');
            const btn = document.getElementById('save-profile-btn');
            const originalText = btn.textContent;
            const originalBg = btn.style.background;
            
            btn.textContent = '✅ 已保存';
            btn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
            btn.style.transform = 'scale(1.02)';
            
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = originalBg;
            }, 2000);
        });
    });
    
    // ========== 保存配置 ==========
    document.getElementById('save-config-btn').addEventListener('click', () => {
        const config = {
            apiKey: document.getElementById('api-key').value.trim(),
            model: document.getElementById('api-model').value
        };
        
        console.log('⚙️ 保存配置:', { ...config, apiKey: config.apiKey ? '***' : '(空)' });
        
        chrome.storage.local.set({ config }, () => {
            if (chrome.runtime.lastError) {
                console.error('❌ 配置保存失败:', chrome.runtime.lastError);
                alert('配置保存失败: ' + chrome.runtime.lastError.message);
                return;
            }
            
            console.log('✅ 配置保存成功');
            const btn = document.getElementById('save-config-btn');
            const originalText = btn.textContent;
            const originalBg = btn.style.background;
            
            btn.textContent = '✅ 已保存';
            btn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
            btn.style.transform = 'scale(1.02)';
            
            setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = originalBg;
            }, 2000);
        });
    });
    
    // ========== 简历解析功能：文件上传 + 解析 + 回填 ==========
    const fileInput = document.getElementById('resume-file-input');
    const parseBtn = document.getElementById('parse-resume-btn');
    const statusEl = document.getElementById('parse-status');
    
    // 文件选择事件：更新状态显示
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const sizeMB = (file.size / 1024 / 1024).toFixed(2);
            statusEl.textContent = `✅ 已选择：${file.name} (${sizeMB} MB)`;
            statusEl.style.color = '#48bb78';
            statusEl.style.background = 'rgba(72, 187, 120, 0.1)';
        } else {
            statusEl.textContent = '未选择文件';
            statusEl.style.color = '#64748b';
            statusEl.style.background = 'rgba(100, 116, 139, 0.08)';
        }
    });
    
    // 解析按钮点击事件
    parseBtn.addEventListener('click', async () => {
        await onParseResumeClick();
    });
    
    /**
     * 合并 profile 对象的策略函数
     * @param {Object} currentProfile - 当前 storage 中的 profile
     * @param {Object} parsedProfile - 解析出来的 profile
     * @returns {Object} 合并后的 newProfile
     */
    function mergeProfiles(currentProfile, parsedProfile) {
        const newProfile = JSON.parse(JSON.stringify(currentProfile || {})); // 深拷贝
        
        // 基本信息：逼字段覆盖
        if (parsedProfile.basic) {
            newProfile.basic = newProfile.basic || {};
            Object.keys(parsedProfile.basic).forEach(key => {
                if (parsedProfile.basic[key]) {
                    newProfile.basic[key] = parsedProfile.basic[key];
                }
            });
        }
        
        // 数组维度：整体替换（以简历为准）
        const arrayFields = [
            'education', 'award', 'competition', 'project', 
            'internship', 'workExperience', 'language', 
            'certificate', 'familyMembers'
        ];
        arrayFields.forEach(field => {
            if (Array.isArray(parsedProfile[field]) && parsedProfile[field].length > 0) {
                newProfile[field] = parsedProfile[field];
            }
        });
        
        // 嵌套数组维度
        if (parsedProfile.campus) {
            newProfile.campus = parsedProfile.campus;
        }
        if (parsedProfile.socialPractice) {
            newProfile.socialPractice = parsedProfile.socialPractice;
        }
        if (parsedProfile.professionalAchievement) {
            newProfile.professionalAchievement = parsedProfile.professionalAchievement;
        }
        
        // 单字段维度
        if (parsedProfile.skill?.description) {
            newProfile.skill = { description: parsedProfile.skill.description };
        }
        if (parsedProfile.selfEvaluation?.description) {
            newProfile.selfEvaluation = { description: parsedProfile.selfEvaluation.description };
        }
        if (parsedProfile.specialNotes?.description) {
            newProfile.specialNotes = { description: parsedProfile.specialNotes.description };
        }
        
        return newProfile;
    }
    
    /**
     * 解析简历按钮点击处理函数
     */
    async function onParseResumeClick() {
        const file = fileInput.files[0];
        
        // 1. 校验文件是否选择
        if (!file) {
            alert('请先选择简历文件');
            return;
        }
        
        // 2. 校验文件扩展名
        const fileName = file.name.toLowerCase();
        const validExtensions = ['.pdf', '.doc', '.docx'];
        const isValidExt = validExtensions.some(ext => fileName.endsWith(ext));
        if (!isValidExt) {
            alert('仅支持 PDF、Word 格式（.pdf, .doc, .docx）');
            return;
        }
        
        // 3. 校验文件大小（优化版：提供更详细的警告和建议）
        const maxSizeMB = 10;
        const fileSizeMB = file.size / 1024 / 1024;
        if (fileSizeMB > maxSizeMB) {
            alert(`文件太大（${fileSizeMB.toFixed(2)} MB），请使用小于 ${maxSizeMB} MB 的文件\n\n建议：\n1. 将文件另存为 PDF 格式（通常更小）\n2. 压缩文件中的图片\n3. 移除不必要的页面或内容`);
            return;
        }
        
        // 对较大文件给出警告（但不阻止）
        if (fileSizeMB > 5) {
            const shouldContinue = confirm(`⚠️ 文件较大（${fileSizeMB.toFixed(2)} MB），解析可能需要较长时间（30-60秒）。\n\n是否继续？\n\n建议：如果文件包含大量图片，考虑先移除图片以提高解析速度。`);
            if (!shouldContinue) {
                return;
            }
        }
        
        // 对 .docx 格式的大文件给出额外警告
        if (fileName.endsWith('.docx') && fileSizeMB > 3) {
            console.warn(`⚠️ 大型 Word 文件（${fileSizeMB.toFixed(2)} MB），解析可能需要 20-40 秒`);
        }
        
        // 4. 获取 AI API 配置
        const configResult = await new Promise((resolve) => {
            chrome.storage.local.get('config', resolve);
        });
        
        if (!configResult.config || !configResult.config.apiKey) {
            alert('请先到「⚙️ 设置」页面配置 API Key');
            return;
        }
        
        const { apiKey, model } = configResult.config;
        
        // 5. 解析过程状态管理
        parseBtn.disabled = true;
        statusEl.textContent = '⏳ 步骤 1/3: 提取文件文本...';
        statusEl.style.color = '#4a90e2';
        statusEl.style.background = 'rgba(74, 144, 226, 0.1)';
        console.log('📄 开始解析上传的简历文件...');
        
        // 创建进度更新函数
        const updateProgress = (step, total, message) => {
            statusEl.textContent = `⏳ 步骤 ${step}/${total}: ${message}`;
        };
        
        try {
            // 6. 调用 profile.js 的解析函数（传入 API 配置和进度回调）
            const parsedProfile = await window.parseResumeFile(file, apiKey, model, updateProgress);
            console.log('✅ 简历解析成功，准备更新 profile');
            
            // 7. 获取当前 profile 并合并
            const result = await new Promise((resolve) => {
                chrome.storage.local.get('profile', resolve);
            });
            const currentProfile = result.profile || {};
            const newProfile = mergeProfiles(currentProfile, parsedProfile);
            console.log('🔀 profile 合并完成', newProfile);
            
            // 8. 渲染到表单（使用批量更新优化性能）
            statusEl.textContent = '⏳ 正在渲染到表单...';
            // 使用 requestAnimationFrame 批量更新，避免阻塞
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    renderProfileToForm(newProfile);
                    console.log('🖥️ 已渲染到表单');
                    resolve();
                });
            });
            
            // 9. 保存到 storage
            await new Promise((resolve, reject) => {
                chrome.storage.local.set({ profile: newProfile }, () => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve();
                    }
                });
            });
            console.log('✅ profile 已更新并渲染到表单');
            
            // 10. 成功状态反馈
            statusEl.textContent = '✅ 解析成功，已填入表单，请确认后保存或直接使用智能填充';
            statusEl.style.color = '#48bb78';
            statusEl.style.background = 'rgba(72, 187, 120, 0.15)';
            
            // 按钮动效
            parseBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
            parseBtn.textContent = '✅ 解析完成';
            setTimeout(() => {
                parseBtn.textContent = '📄 上传并解析简历';
                parseBtn.style.background = '';
            }, 2000);
            
        } catch (error) {
            // 10. 错误处理
            console.error('❌ 解析失败:', error);
            statusEl.textContent = `❌ 解析失败：${error.message}`;
            statusEl.style.color = '#e74c3c';
            statusEl.style.background = 'rgba(231, 76, 60, 0.1)';
            alert(`解析失败：${error.message}

请检查：
1. 后端 API 是否正常运行
2. 网络连接是否正常
3. 文件格式是否正确`);
        } finally {
            // 11. 恢复按钮状态
            parseBtn.disabled = false;
        }
    }

    // ========== AI 运行 ==========
    const aiFillBtn = document.getElementById('ai-fill-btn');
    aiFillBtn.addEventListener('click', async () => {
        const data = await chrome.storage.local.get(['profile', 'config']);
        if (!data.config?.apiKey) return alert('请先设置 API Key');
        
        runAiAutoFill(data.config, data.profile, aiFillBtn);
    });

    // ========== 快速填充（10秒内完成）==========
    const quickFillBtn = document.getElementById('quick-fill-btn');
    if (quickFillBtn) {
        quickFillBtn.addEventListener('click', async () => {
            const data = await chrome.storage.local.get(['config']);
            if (!data.config?.apiKey) return alert('请先设置 API Key');
            
            // 检查是否有上传的简历文件
            const file = fileInput.files[0];
            if (!file) {
                alert('请先上传简历文件（PDF 或 Word）');
                return;
            }
            
            runQuickFill(data.config, file, quickFillBtn);
        });
    }

    /**
     * 快速填充：10秒内完成简历解析和填充（不使用规则匹配）
     * 策略：
     * 1. 并行处理：同时提取文本和扫描表单
     * 2. 合并AI调用：一次性解析简历并匹配字段
     * 3. 优化prompt：更简洁，减少token
     * 4. 直接填充：跳过中间步骤
     */
    async function runQuickFill(config, file, btn) {
        const startTime = Date.now();
        try {
            btn.disabled = true;
            btn.textContent = '⚡ 快速处理中...';
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            log('⚡ 开始快速填充（目标：10秒内完成）...');
            
            // ========== 步骤1：并行处理 ==========
            log('📋 步骤1/4: 并行处理（提取文本 + 扫描表单）...');
            btn.textContent = '⚡ 并行处理...';
            
            // 注入 content_script.js（用于扫描表单）
            await chrome.scripting.executeScript({ 
                target: { tabId: tab.id }, 
                files: ['content_script.js'] 
            });
            
            // 并行执行：文本提取 + 表单扫描
            const [extractedText, scanResult] = await Promise.all([
                // 提取文本（使用 parseResumeFile 但只获取文本部分，不完整解析）
                (async () => {
                    try {
                        // 使用 parseResumeFile 的文本提取部分
                        // 注意：这里我们只提取文本，不进行AI解析
                        const fileName = file.name.toLowerCase();
                        
                        if (fileName.endsWith('.pdf')) {
                            // 直接调用 profile.js 内部函数（如果可用）
                            // 否则使用完整解析但只取文本
                            if (typeof window.extractTextFromPDF === 'function') {
                                return await window.extractTextFromPDF(file);
                            }
                        } else if (fileName.endsWith('.docx')) {
                            if (typeof window.extractTextFromWord === 'function') {
                                return await window.extractTextFromWord(file, () => {});
                            }
                        }
                        
                        // 如果直接提取不可用，使用完整解析流程（但会慢一些）
                        // 为了速度，我们使用一个简化的文本提取
                        log('⚠️ 使用完整解析流程（可能较慢）...');
                        const profile = await window.parseResumeFile(file, config.apiKey, config.model, () => {});
                        // 将 profile 转换为文本描述
                        return JSON.stringify(profile, null, 2);
                    } catch (error) {
                        console.error('文本提取失败:', error);
                        throw new Error(`文本提取失败: ${error.message}`);
                    }
                })(),
                // 扫描表单（等待脚本注入完成）
                (async () => {
                    await new Promise(r => setTimeout(r, 200));
                    return await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_FORM' });
                })()
            ]);
            
            const elapsed1 = Date.now() - startTime;
            log(`✅ 并行处理完成（${elapsed1}ms），文本长度: ${extractedText.length}，字段数: ${scanResult.fields.length}`);
            
            // ========== 步骤2：合并AI调用（解析+匹配）==========
            log('🧠 步骤2/4: AI 解析并匹配（合并调用）...');
            btn.textContent = '🧠 AI 处理中...';
            
            const mapping = await callQuickFillAPI(
                config.apiKey, 
                config.model, 
                extractedText, 
                scanResult.fields,
                file.name
            );
            
            const elapsed2 = Date.now() - startTime;
            log(`✅ AI 处理完成（${elapsed2}ms），匹配了 ${Object.keys(mapping).filter(k => mapping[k] !== null).length} 个字段`);
            
            // ========== 步骤3：扩展表单 ==========
            log('🖱️ 步骤3/4: 扩展表单...');
            btn.textContent = '🖱️ 扩展表单...';
            
            // 从 mapping 推断需要扩展的数量
            const counts = inferSectionCounts(mapping, scanResult.fields);
            await chrome.tabs.sendMessage(tab.id, { action: 'EXPAND_FORM', counts });
            
            // ========== 步骤4：填充数据 ==========
            log('✍️ 步骤4/4: 填充数据...');
            btn.textContent = '✍️ 填充中...';
            
            // 重新扫描（扩展后可能有新字段）
            const finalScan = await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_FORM' });
            const finalMapping = await callQuickFillAPI(
                config.apiKey,
                config.model,
                extractedText,
                finalScan.fields,
                file.name
            );
            
            const fillRes = await chrome.tabs.sendMessage(tab.id, { 
                action: 'APPLY_MAPPING', 
                mapping: finalMapping 
            });
            
            const totalTime = Date.now() - startTime;
            const successCount = fillRes.count || 0;
            
            log(`✅ 快速填充完成！`);
            log(`📊 总耗时: ${(totalTime/1000).toFixed(1)}秒，填充了 ${successCount} 个字段`);
            
            if (totalTime <= 10000) {
                btn.textContent = `✅ ${(totalTime/1000).toFixed(1)}秒完成`;
            } else {
                btn.textContent = `✅ 完成（${(totalTime/1000).toFixed(1)}秒）`;
            }
            
        } catch (e) {
            const totalTime = Date.now() - startTime;
            log(`❌ 快速填充失败: ${e.message}（耗时: ${(totalTime/1000).toFixed(1)}秒）`);
            console.error(e);
            btn.textContent = '❌ 失败';
            alert(`快速填充失败：${e.message}\n\n耗时: ${(totalTime/1000).toFixed(1)}秒`);
        } finally {
            setTimeout(() => { 
                btn.disabled = false; 
                if(btn.textContent.includes('完成') || btn.textContent === '❌ 失败') {
                    btn.textContent = '⚡ 快速填充（10秒内）';
                }
            }, 3000);
        }
    }
    
    /**
     * 快速填充API调用（合并解析和匹配）
     */
    async function callQuickFillAPI(apiKey, model, resumeText, formFields, fileName) {
        // 优化后的简洁 prompt
        const systemPrompt = `你是简历解析和表单填充助手。一次性完成两个任务：
1. 从简历文本提取结构化信息
2. 将信息匹配到表单字段

输入：
- resume_text: 简历纯文本
- form_fields: 表单字段列表 [{id, label, type, context, sectionIndex, options?}]

规则：
- context决定数据源：Education->education[], Work/Internship->internship[]或workExperience[], Basic Info->basic, 等等
- sectionIndex决定使用第几段数据（0=第一段）
- 时间格式：YYYY.M
- 下拉框：匹配options中的value或text

返回：{"field_id": "value" 或 null}`;

        // 限制文本长度（快速处理）
        const maxTextLength = 6000; // 减少到6000字符，加快处理
        const truncatedText = resumeText.length > maxTextLength 
            ? resumeText.substring(0, maxTextLength) + '\n[已截断]'
            : resumeText;
        
        // 限制字段数量（只处理前50个字段，加快处理）
        const limitedFields = formFields.slice(0, 50);
        
        const userPrompt = `简历：${fileName}\n\n${truncatedText}\n\n表单字段：${JSON.stringify(limitedFields)}`;
        
        const requestBody = {
            model: model || "Qwen/Qwen2.5-72B-Instruct",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
            max_tokens: 4096 // 减少token，加快响应
        };
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时（快速模式）
        
        try {
            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`API 调用失败: HTTP ${response.status}`);
            }
            
            const data = await response.json();
            if (data.error) {
                throw new Error(`API 错误: ${data.error.message}`);
            }
            
            const content = data.choices[0].message.content;
            return JSON.parse(content);
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('AI 处理超时（8秒），请尝试使用较小的简历文件');
            }
            throw error;
        }
    }
    
    /**
     * 从 mapping 推断需要扩展的段落数量
     */
    function inferSectionCounts(mapping, fields) {
        const counts = {};
        const sectionTypes = {
            'Education': 'education',
            'Work/Internship': 'internship',
            'Work Experience': 'workExperience',
            'Project': 'project',
            'Award': 'award',
            'Competition': 'competition',
            'Language': 'language',
            'Certificate': 'certificate',
            'Family': 'familyMembers',
            'Campus Leader': 'campusLeader',
            'Campus Activity': 'campusActivity',
            'Volunteer': 'volunteer',
            'Social Project': 'socialProject',
            'Paper': 'paper',
            'Patent': 'patent',
            'Conference': 'conference'
        };
        
        // 统计每个 context 的最大 sectionIndex
        fields.forEach(field => {
            const context = field.context;
            const sectionType = sectionTypes[context];
            if (sectionType && field.sectionIndex !== undefined) {
                if (!counts[sectionType] || counts[sectionType] < field.sectionIndex + 1) {
                    counts[sectionType] = field.sectionIndex + 1;
                }
            }
        });
        
        return counts;
    }
    

    async function runAiAutoFill(config, profile, btn) {
        try {
            btn.disabled = true;
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // ========== 第一阶段：基础规则填充 ==========
            log('📋 第一阶段：基础规则填充...');
            btn.textContent = '📋 基础填充...';
            
            let basicFillRes = { count: 0 }; // 初始化默认值
            
            try {
                // 注入 content.js
                await chrome.scripting.executeScript({ 
                    target: { tabId: tab.id }, 
                    files: ['content.js'] 
                });
                
                // 等待脚本注入完成
                await new Promise(r => setTimeout(r, 300));
                
                // 执行基础填充（带超时保护）
                const fillPromise = chrome.tabs.sendMessage(tab.id, { action: 'BASIC_FILL' });
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('基础填充超时（35秒）')), 35000)
                );
                
                basicFillRes = await Promise.race([fillPromise, timeoutPromise]);
                
                if (basicFillRes && basicFillRes.success) {
                    log(`✅ 基础填充完成，填充了 ${basicFillRes.count} 个字段`);
                } else if (basicFillRes && basicFillRes.error) {
                    log(`⚠️ 基础填充警告: ${basicFillRes.error}`);
                }
            } catch (basicError) {
                log(`⚠️ 基础填充阶段出错: ${basicError.message}，继续执行 AI 填充...`);
                console.warn('基础填充错误:', basicError);
                basicFillRes = { count: 0 }; // 确保有默认值
            }
            
            // 等待 DOM 更新
            await new Promise(r => setTimeout(r, 500));
            
            // ========== 第二阶段：AI 智能填充 ==========
            log('🤖 第二阶段：AI 智能填充...');
            btn.textContent = '🖱️ 扩展表单...';
            
            // 注入 content_script.js
            await chrome.scripting.executeScript({ 
                target: { tabId: tab.id }, 
                files: ['content_script.js'] 
            });
            
            // 扩展表单
            const counts = {
                education: profile.education?.length || 0,
                internship: profile.internship?.length || 0,
                workExperience: profile.workExperience?.length || 0,
                project: profile.project?.length || 0,
                award: profile.award?.length || 0,
                competition: profile.competition?.length || 0,
                language: profile.language?.length || 0,
                certificate: profile.certificate?.length || 0,
                familyMembers: profile.familyMembers?.length || 0,
                campusLeader: profile.campus?.leader?.length || 0,
                campusActivity: profile.campus?.activity?.length || 0,
                volunteer: profile.socialPractice?.volunteer?.length || 0,
                socialProject: profile.socialPractice?.project?.length || 0,
                paper: profile.professionalAchievement?.paper?.length || 0,
                patent: profile.professionalAchievement?.patent?.length || 0,
                conference: profile.professionalAchievement?.conference?.length || 0
            };
            await chrome.tabs.sendMessage(tab.id, { action: 'EXPAND_FORM', counts: counts });
            
            btn.textContent = '👀 扫描字段...';
            const scanRes = await chrome.tabs.sendMessage(tab.id, { action: 'SCAN_FORM' });
            log(`扫描到 ${scanRes.fields.length} 个字段`);

            btn.textContent = '🧠 AI 匹配中...';
            const mapping = await callDeepSeekAPI(config.apiKey, config.model, profile, scanRes.fields);
            
            btn.textContent = '✍️ 写入数据...';
            const fillRes = await chrome.tabs.sendMessage(tab.id, { action: 'APPLY_MAPPING', mapping });
            
            const basicCount = (basicFillRes && basicFillRes.count) || 0;
            const aiCount = fillRes.count || 0;
            log(`✅ AI 填充完成，填充了 ${aiCount} 个字段`);
            log(`📊 总计填充：${basicCount + aiCount} 个字段（基础：${basicCount}，AI：${aiCount}）`);
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

    // ========== AI API 调用 ==========
    async function callDeepSeekAPI(apiKey, model, profile, formFields) {
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

        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || "Qwen/Qwen2.5-72B-Instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: JSON.stringify({ user_resume: profile, web_fields: formFields }) }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 8192
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const content = data.choices[0].message.content;
        console.log("🤖 DeepSeek Raw Output:", content);
        log("🤖 模型返回数据");

        return JSON.parse(content);
    }

    // =====================================================
    // ========== 调试模块：字段识别诊断工具 ==========
    // ========== 调试完毕后可整体注释掉下面代码块 ==========
    // =====================================================
    
    // 监听来自 debug_field_analyzer.js 的报告
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'DEBUG_REPORT') {
            displayDebugReport(message.report, message.summary);
            sendResponse({ received: true });
        }
    });

    // 在日志区显示调试报告
    function displayDebugReport(report, summary) {
        const logArea = document.getElementById('log-area');
        
        // 清空日志区
        logArea.innerHTML = '';
        
        // 添加标题
        const header = document.createElement('div');
        header.style.cssText = 'font-weight: 700; font-size: 14px; color: #48bb78; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid rgba(72, 187, 120, 0.3);';
        header.textContent = `🔍 字段识别诊断报告 (共 ${summary.total} 个问题字段)`;
        logArea.appendChild(header);

        // 添加统计概览
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'background: rgba(159, 122, 234, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; line-height: 1.6;';
        summaryDiv.innerHTML = `
            <div style="color: #9f7aea; font-weight: 600; margin-bottom: 6px;">问题分类统计：</div>
            ${summary.contextUnknown > 0 ? `<div>❌ 上下文未知: ${summary.contextUnknown} 个</div>` : ''}
            ${summary.noDataSource > 0 ? `<div>📦 简历数据缺失: ${summary.noDataSource} 个</div>` : ''}
            ${summary.labelNotMatched > 0 ? `<div>🏷️ 标签未匹配: ${summary.labelNotMatched} 个</div>` : ''}
            ${summary.profileFieldEmpty > 0 ? `<div>📝 字段为空: ${summary.profileFieldEmpty} 个</div>` : ''}
            ${summary.selectNoMatch > 0 ? `<div>🔽 下拉选项不匹配: ${summary.selectNoMatch} 个</div>` : ''}
            ${summary.skipProtected > 0 ? `<div>🔒 保护跳过: ${summary.skipProtected} 个</div>` : ''}
        `;
        logArea.appendChild(summaryDiv);

        // 添加详细列表
        if (report.length === 0) {
            const noIssue = document.createElement('div');
            noIssue.style.cssText = 'color: #48bb78; text-align: center; padding: 20px;';
            noIssue.textContent = '✅ 没有发现问题字段！';
            logArea.appendChild(noIssue);
            return;
        }

        const listTitle = document.createElement('div');
        listTitle.style.cssText = 'color: #e2e8f0; font-weight: 600; margin: 12px 0 8px 0; font-size: 12px;';
        listTitle.textContent = '详细列表：';
        logArea.appendChild(listTitle);

        // 按问题类型分组
        const issueTypes = {
            'CONTEXT_UNKNOWN': { name: '上下文未知', icon: '❌', color: '#fc8181' },
            'NO_DATA_SOURCE': { name: '简历数据缺失', icon: '📦', color: '#f6ad55' },
            'LABEL_NOT_MATCHED': { name: '标签未匹配', icon: '🏷️', color: '#fbd38d' },
            'PROFILE_FIELD_EMPTY': { name: '字段为空', icon: '📝', color: '#90cdf4' },
            'SELECT_NO_MATCH_OPTION': { name: '下拉选项不匹配', icon: '🔽', color: '#9f7aea' },
            'SKIP_PROTECTED': { name: '保护跳过', icon: '🔒', color: '#68d391' }
        };

        report.slice(0, 20).forEach((item, idx) => {
            const itemDiv = document.createElement('div');
            itemDiv.style.cssText = 'background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 4px; margin-bottom: 6px; font-size: 10px; border-left: 3px solid #9f7aea;';
            
            const primaryIssue = item.issues[0];
            const issueKey = Object.keys(issueTypes).find(k => primaryIssue.includes(k)) || 'CONTEXT_UNKNOWN';
            const issueInfo = issueTypes[issueKey];

            itemDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #e2e8f0; font-weight: 600;">${item.label || item.id || '无标签'}</span>
                    <span style="color: ${issueInfo.color}; font-size: 9px;">${issueInfo.icon} ${issueInfo.name}</span>
                </div>
                <div style="color: #a0aec0; font-size: 9px;">
                    <span>上下文: ${item.contextType}[${item.sectionIndex}]</span>
                    ${item.matchedKey ? ` | 匹配: ${item.matchedKey}` : ''}
                </div>
                <div style="color: #718096; font-size: 9px; margin-top: 2px;">
                    ${item.issues.map(i => `• ${translateIssue(i)}`).join(' ')}
                </div>
            `;
            logArea.appendChild(itemDiv);
        });

        if (report.length > 20) {
            const moreDiv = document.createElement('div');
            moreDiv.style.cssText = 'color: #a0aec0; text-align: center; padding: 8px; font-size: 10px;';
            moreDiv.textContent = `... 还有 ${report.length - 20} 个问题字段，请在 DevTools Console 查看完整报告`;
            logArea.appendChild(moreDiv);
        }

        // 添加查看提示
        const tip = document.createElement('div');
        tip.style.cssText = 'margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); color: #a0aec0; font-size: 10px;';
        tip.innerHTML = '💡 提示：在目标网页 Console 输入 <code style="color: #48bb78;">window.JobAutoFillDebugReport</code> 查看完整数据';
        logArea.appendChild(tip);
    }

    // 翻译问题代码为中文
    function translateIssue(issue) {
        const translations = {
            'CONTEXT_UNKNOWN': '无法识别模块',
            'NO_DATA_SOURCE': '简历未填该段',
            'LABEL_NOT_MATCHED': '同义词未匹配',
            'PROFILE_FIELD_EMPTY': '简历字段为空',
            'SELECT_NO_MATCH_OPTION': '下拉选项无匹配',
            'SKIP_PROTECTED_SELECT': '下拉框已有值',
            'SKIP_PROTECTED_EXISTING': '输入框已有值'
        };
        for (const [key, value] of Object.entries(translations)) {
            if (issue.includes(key)) return value;
        }
        return issue;
    }

    const debugAnalyzeBtn = document.getElementById('debug-analyze-btn');
    if (debugAnalyzeBtn) {
        debugAnalyzeBtn.addEventListener('click', async () => {
            try {
                debugAnalyzeBtn.disabled = true;
                const originalText = debugAnalyzeBtn.textContent;
                debugAnalyzeBtn.textContent = '⏳ 注入调试脚本...';

                // 获取当前活动标签页
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tab) {
                    log('❌ 未找到活动标签页');
                    alert('未找到活动标签页，请确保有网页处于打开状态');
                    return;
                }

                // 注入调试分析脚本
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['debug_field_analyzer.js']
                });

                if (chrome.runtime.lastError) {
                    log(`❌ 注入失败: ${chrome.runtime.lastError.message}`);
                    alert(`注入失败: ${chrome.runtime.lastError.message}`);
                    debugAnalyzeBtn.textContent = '❌ 失败';
                } else {
                    log('✅ 调试脚本已注入，请查看目标网页的 DevTools Console');
                    debugAnalyzeBtn.textContent = '✅ 已注入';
                    debugAnalyzeBtn.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
                    
                    // 提示用户
                    setTimeout(() => {
                        alert('调试脚本已注入成功！\n\n请：\n1. 切换到目标网页\n2. 右键 → 检查(Inspect)\n3. 在 Console 里查看 "JobAutoFill Debug" 输出\n4. 或输入 window.JobAutoFillDebugReport 查看详细数据');
                    }, 100);
                }

            } catch (e) {
                log(`❌ 调试工具错误: ${e.message}`);
                console.error('调试工具错误:', e);
                alert(`调试工具错误: ${e.message}`);
                debugAnalyzeBtn.textContent = '❌ 出错';
            } finally {
                setTimeout(() => {
                    debugAnalyzeBtn.disabled = false;
                    if (debugAnalyzeBtn.textContent === '✅ 已注入' || debugAnalyzeBtn.textContent === '❌ 失败' || debugAnalyzeBtn.textContent === '❌ 出错') {
                        debugAnalyzeBtn.textContent = '🔍 调试字段识别';
                        debugAnalyzeBtn.style.background = 'linear-gradient(135deg, #9f7aea 0%, #805ad5 100%)';
                    }
                }, 3000);
            }
        });
    }
    
    // =====================================================
    // ========== 调试模块结束 ==========
    // =====================================================

});
