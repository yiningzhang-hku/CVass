(function() {
    console.log("JobAutoFill: 开始运行...");

    // ========== 1. 定义同义词词典 (扩展版，支持所有维度，增强匹配成功率) ==========
    const keywords = {
        // ===== 基本信息 =====
        name: ['姓名', 'name', 'full name', '中文名', '真实姓名', '中文姓名', '姓名（必填）', '姓名*', '姓名：', 'name：', '申请人姓名', '应聘者姓名'],
        phone: ['手机', '电话', 'phone', 'mobile', 'cellphone', '联系电话', '手机号', '手机号码', '电话号', '电话号码', '手机（必填）', '联系电话（必填）', '手机*', '电话*', '联系方式', '联系手机', '手机号：', '电话：', '联系电话：'],
        email: ['邮箱', 'email', 'mail', '电子邮箱', 'e-mail', 'email地址', '邮箱地址', '电子信箱', '邮箱（必填）', '邮箱*', 'email：', '邮箱：', 'e-mail地址', '电子邮箱：'],
        gender: ['性别', 'gender', 'sex', '性', '性别：'],
        birthDate: ['出生日期', 'birth', 'birthday', '出生年月', '生日', '出生年月日', '出生时间', '出生', '出生日期（必填）', '出生日期*', '生日：', '出生年月：', '出生日期：'],
        ethnicity: ['民族', 'ethnicity', 'ethnic', '民族：'],
        nationality: ['国籍', 'nationality', 'citizenship', '国籍：'],
        hometown: ['户籍', 'hometown', '籍贯', '户口所在地', '户籍所在', '户籍地', '户口', '户籍地址', '户口地址', '户籍：', '籍贯：', '户口所在地：'],
        currentAddress: ['现居', 'current address', '居住地', '现住址', '目前住址', '现居住地址', '现居住地', '居住地址', '现住地', '现居地址', '现居住地：', '居住地：'],
        maritalStatus: ['婚姻', 'marital', '婚姻状况', 'married', '婚姻状态', '婚否', '婚姻：', '婚姻状况：'],
        politicalStatus: ['政治面貌', 'political', '党派', '政治', '政治面貌：', '政治身份'],
        height: ['身高', 'height', '身高（cm）', '身高cm', '身高：'],
        weight: ['体重', 'weight', '体重（kg）', '体重kg', '体重：'],
        
        // ===== 教育经历 =====
        school: ['学校', 'school', 'university', '毕业院校', 'college', '院校', '就读院校', '学校名称', '毕业学校', '就读学校', '大学', '高校', '学校：', '毕业院校：', '就读院校：'],
        major: ['专业', 'major', 'discipline', '所学专业', '专业名称', '就读专业', '专业方向', '专业：', '所学专业：', '专业名称：'],
        degree: ['学历', '学位', 'degree', 'education level', '最高学历', '学历层次', '学历水平', '学历：', '学位：', '最高学历：', '学历/学位'],
        gpa: ['绩点', 'gpa', '平均分', '平均绩点', 'gpa成绩', '绩点成绩', 'gpa：', '绩点：', '平均分：'],
        scorePercent: ['百分制', '成绩', 'score', '均分', '平均成绩', '总成绩', '成绩：', '均分：', '平均成绩：'],
        college: ['院系', '学院', 'department', 'academy', 'faculty', '所属院系', '所在学院', '院系名称', '学院名称', '院系：', '学院：'],
        startDate: ['开始时间', '入学时间', 'start date', 'from', '起始时间', '开始日期', '入学日期', '就读开始', '开始就读', '入学：', '开始时间：', '入学时间：'],
        endDate: ['结束时间', '毕业时间', 'end date', 'to', '截止时间', '结束日期', '毕业日期', '就读结束', '毕业：', '结束时间：', '毕业时间：'],
        schoolSystem: ['学制', 'duration', '年制', '学制年限', '学制：', '年制：'],
        status: ['状态', 'status', '在读', '毕业', '就读状态', '毕业状态', '状态：', '就读状态：'],
        eduType: ['学历性质', '全日制', '非全日制', 'education type', '学习形式', '学历类型', '学历性质：', '学习形式：'],
        lab: ['实验室', 'lab', 'laboratory', '所在实验室', '实验室名称', '实验室：'],
        advisor: ['导师', '指导教师', 'advisor', 'supervisor', '指导老师', '导师姓名', '导师：', '指导教师：'],
        thesisTitle: ['论文题目', '毕业设计', 'thesis', '毕业论文', '论文名称', '毕业论文题目', '毕业设计题目', '论文：', '毕业论文：'],
        thesisAdvisor: ['论文导师', 'thesis advisor', '毕业论文导师', '论文指导老师', '论文导师：'],
        minorSchool: ['辅修院校', 'minor school', '双学位院校', '辅修学校', '双学位学校', '辅修院校：'],
        minorDegree: ['辅修学位', 'minor degree', '双学位', '辅修专业学位', '双学位类型', '辅修学位：'],
        exchangeSchool: ['交换院校', '留学院校', 'exchange school', '海外院校', '交换学校', '留学学校', '交换院校：'],
        exchangeDate: ['交换时间', 'exchange date', '留学时间', '交换日期', '留学日期', '交换时间：'],
        exchangeCourse: ['交换课程', 'exchange course', '修读课程', '交换学习课程', '交换课程：'],

        // ===== 实习/工作经历 =====
        company: ['公司', 'company', 'employer', '单位', '工作单位', '企业', '公司名称', '单位名称', '企业名称', '就职公司', '工作公司', '公司：', '工作单位：', '单位：'],
        department: ['部门', 'department', '所属部门', '部门名称', '所在部门', '工作部门', '部门：', '所属部门：'],
        position: ['职位', '岗位', 'position', 'job title', 'role', '职务', '职位名称', '岗位名称', '工作职位', '担任职位', '职位：', '岗位：', '职务：'],
        description: ['描述', '内容', 'description', 'responsibility', 'duty', '工作内容', '职责', '工作描述', '工作职责', '工作内容描述', '主要工作', '工作说明', '工作内容：', '职责：', '工作描述：'],

        // ===== 项目经历 =====
        projectName: ['项目名称', 'project name', '项目名', '项目', '项目：', '项目名称：'],
        role: ['角色', 'role', '担任角色', '项目角色', '在项目中的角色', '项目职责', '角色：', '担任角色：'],

        // ===== 获奖经历 =====
        awardType: ['获奖类型', 'award type', '奖项类型', '获奖级别', '奖项类型', '级别', '获奖类型：'],
        awardName: ['获奖名称', 'award name', '奖项名称', '荣誉名称', '奖项', '获奖', '奖项名称：', '获奖名称：'],
        awardDate: ['获奖时间', 'award date', '获奖日期', '获奖年月', '获奖时间：'],

        // ===== 竞赛经历 =====
        competitionName: ['赛事名称', 'competition name', '竞赛名称', '比赛名称', '竞赛', '比赛', '赛事', '竞赛名称：', '比赛名称：'],
        competitionLevel: ['赛事级别', 'competition level', '竞赛级别', '比赛级别', '级别', '竞赛级别：'],
        competitionAward: ['奖项', 'prize', '比赛奖项', '竞赛成绩', '获奖情况', '竞赛奖项', '获奖等级', '奖项：', '竞赛成绩：'],
        teamRole: ['团队角色', 'team role', '队内职责', '在团队中的角色', '团队职责', '角色', '团队角色：'],

        // ===== 语言能力 =====
        language: ['语言', 'language', '外语', '语言种类', '语种', '语言：', '外语：'],
        languageScore: ['成绩', 'score', '等级', '分数', 'level', '语言成绩', '外语成绩', '语言等级', '外语等级', '成绩：', '等级：', '分数：'],

        // ===== 专业资格证书 =====
        certificateName: ['证书名称', 'certificate name', '资格证书', '证书', '证书名称：', '资格证书：'],
        certificateDate: ['取得时间', 'certificate date', '获证时间', '获得时间', '证书取得时间', '获证日期', '取得时间：'],

        // ===== 家庭成员 =====
        familyName: ['姓名', 'name', '家属姓名', '家庭成员姓名', '姓名：'],
        relation: ['关系', 'relation', '与本人关系', '亲属关系', '关系：', '与本人关系：'],
        familyPhone: ['联系方式', 'phone', '家属电话', '联系电话', '电话', '联系方式：'],
        familyCompany: ['工作单位', 'company', '家属单位', '单位', '工作单位：'],
        familyPosition: ['职务', 'position', '家属职务', '职位', '职务：'],

        // ===== 专业成果 - 论文 =====
        paperTitle: ['论文题目', 'paper title', '论文名称', '文章标题', '论文', '论文题目：'],
        journal: ['期刊', 'journal', '期刊名称', '发表刊物', '发表期刊', '期刊：', '发表刊物：'],
        authorOrder: ['作者排序', 'author order', '作者顺位', '排名', '作者顺序', '排序', '作者排序：'],
        doi: ['doi', 'DOI', '链接', 'doi号', 'DOI号', 'doi：'],

        // ===== 专业成果 - 专利 =====
        patentName: ['专利名称', 'patent name', '专利', '专利名称：'],
        patentNumber: ['专利号', 'patent number', '申请号', '专利编号', '专利号：'],
        patentType: ['专利类型', 'patent type', '类型', '专利类型：'],
        patentStatus: ['授权状态', 'patent status', '状态', '专利状态', '授权状态：'],
        patentRole: ['本人角色', 'inventor', '发明人', '角色', '在专利中的角色', '本人角色：'],

        // ===== 专业成果 - 学术会议 =====
        conferenceName: ['会议名称', 'conference name', '学术会议', '会议', '会议名称：'],
        topic: ['演讲主题', 'topic', '主题', '报告题目', '报告主题', '主题：', '演讲主题：'],
        conferenceDate: ['会议时间', 'conference date', '会议日期', '会议时间：'],

        // ===== 在校经历 =====
        leaderPosition: ['职务名称', 'position', '干部职务', '学生干部', '职务', '担任职务', '职务名称：'],
        activityName: ['活动名称', 'activity name', '活动', '活动名称：'],

        // ===== 社会实践 =====
        organization: ['公益组织', 'organization', '志愿组织', '机构', '组织名称', '组织', '机构名称', '组织：'],
        duty: ['职责', 'duty', '工作职责', '主要职责', '职责：'],
        hours: ['服务时长', 'hours', '志愿时长', '小时', '服务时间', '时长', '服务时长（小时）', '服务时长：'],
        practiceProject: ['项目名称', 'project name', '实践项目', '项目', '项目名称：'],
        result: ['成果', 'result', '成果描述', '项目成果', '实践成果', '成果：', '项目成果：'],

        // ===== 技能/自我评价/特殊说明 =====
        skillDescription: ['技能', 'skill', '专业技能', '技术能力', '技能描述', '技能特长', '技能：', '专业技能：'],
        selfEvaluation: ['自我评价', 'self evaluation', '个人简介', '自我介绍', '个人总结', '自我描述', '个人评价', '自我评价：', '个人简介：'],
        specialNotes: ['特殊说明', 'special notes', '备注', '其他说明', '其他', '补充说明', '说明', '特殊说明：', '备注：']
    };

    // ========== 2. 消息监听：支持通过消息触发填充（添加超时保护）==========
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'BASIC_FILL') {
            // 设置超时保护（30秒）
            const timeoutId = setTimeout(() => {
                sendResponse({ success: false, error: '填充超时，可能页面字段过多或结构复杂' });
            }, 30000);
            
            chrome.storage.local.get(['profile'], async (result) => {
                try {
                    if (!result.profile) {
                        clearTimeout(timeoutId);
                        sendResponse({ success: false, error: '请先填写简历信息' });
                        return;
                    }
                    
                    // 执行异步填充
                    const count = await autoFill(result.profile);
                    clearTimeout(timeoutId);
                    sendResponse({ success: true, count: count });
                } catch (e) {
                    clearTimeout(timeoutId);
                    console.error('[基础填充] 执行出错:', e);
                    sendResponse({ success: false, error: `填充过程出错: ${e.message}` });
                }
            });
            
            return true; // 保持消息通道开放
        }
    });

    // ========== 关键字段模式定义（与 content_script.js 保持一致）==========
    const keyFieldPatterns = /学校|school|公司|company|项目名|project name|获奖名|award|赛事|competition|论文|paper|专利|patent|证书|certificate|姓名.*(?:家|亲)/i;
    
    // 多段维度类型列表
    const multiSectionTypes = ['education', 'internship', 'workExperience', 'project', 'award', 'competition', 
                                'language', 'certificate', 'familyMembers', 'campusLeader', 'campusActivity', 
                                'volunteer', 'socialProject', 'paper', 'patent', 'conference'];

    // ========== 3. 主填充逻辑（支持所有新维度，异步批处理优化）==========
    async function autoFill(data) {
        const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
        let fillCount = 0;
        
        // 预过滤：快速跳过明显不需要处理的字段
        // 【修改】对基础信息字段放宽保护策略，允许覆盖已有值
        const candidateInputs = inputs.filter(input => {
            try {
                if (input.type === 'hidden' || input.disabled) return false;
                if (input.offsetParent === null) return false; // 不可见
                
                // 【新增】对基础信息字段特殊处理：即使有值也可能需要覆盖
                if (input.value && input.value.trim() !== "") {
                    // 尝试判断是否是基础信息字段
                    const labelText = getLabelText(input);
                    if (labelText && isBasicInfoField(labelText)) {
                        // 基础信息字段即使有值也加入候选列表，后续会判断是否覆盖
                        console.log(`[Candidate] 基础信息字段 "${labelText}" 已有值但仍加入候选: ${input.value}`);
                        return true;
                    }
                    // 非基础信息字段，有值则跳过
                    return false;
                }
                return true;
            } catch (e) {
                return false; // 出错则跳过
            }
        });
        
        console.log(`[基础填充] 找到 ${candidateInputs.length} 个候选字段，开始处理...`);
        
        // 【新增】分段计数器：用于统一多段经历的索引推断
        const sectionIndexCounters = {};
        
        // 批处理：每批处理 10 个字段，避免阻塞主线程
        const BATCH_SIZE = 10;
        for (let i = 0; i < candidateInputs.length; i += BATCH_SIZE) {
            const batch = candidateInputs.slice(i, i + BATCH_SIZE);
            
            // 处理当前批次
            for (const input of batch) {
                try {
                    const labelText = getLabelText(input);
                    if (!labelText) continue;

                    // 检测上下文和段落索引
                    let contextInfo = detectContextAndIndex(input, labelText);
                    let sectionType = contextInfo.type;
                    let sectionIndex = contextInfo.index;
                    
                    // 【新增】统一多段索引推断逻辑
                    if (multiSectionTypes.includes(sectionType)) {
                        // 如果父容器已经明确指定了索引（>0），直接使用
                        if (sectionIndex > 0) {
                            // 更新计数器（确保后续字段不会错位）
                            if (!sectionIndexCounters[sectionType]) {
                                sectionIndexCounters[sectionType] = { currentIndex: sectionIndex, hasSeenKeyField: true };
                            } else if (sectionIndexCounters[sectionType].currentIndex < sectionIndex) {
                                sectionIndexCounters[sectionType].currentIndex = sectionIndex;
                                sectionIndexCounters[sectionType].hasSeenKeyField = true;
                            }
                        } else {
                            // 索引为0，需要通过扫描顺序和关键字段推断
                            const isKeyField = keyFieldPatterns.test(labelText);
                            
                            if (!sectionIndexCounters[sectionType]) {
                                // 第一次遇到这个类型
                                sectionIndexCounters[sectionType] = { currentIndex: 0, hasSeenKeyField: isKeyField };
                                sectionIndex = 0;
                            } else {
                                // 已经处理过这个类型的字段
                                if (isKeyField && sectionIndexCounters[sectionType].hasSeenKeyField) {
                                    // 遇到新的关键字段，说明进入下一段
                                    sectionIndexCounters[sectionType].currentIndex++;
                                    sectionIndexCounters[sectionType].hasSeenKeyField = true;
                                    sectionIndex = sectionIndexCounters[sectionType].currentIndex;
                                } else {
                                    // 使用当前段落索引
                                    sectionIndex = sectionIndexCounters[sectionType].currentIndex;
                                    if (isKeyField) {
                                        sectionIndexCounters[sectionType].hasSeenKeyField = true;
                                    }
                                }
                            }
                        }
                    }
                    
                    // 【新增】调试日志
                    console.log(`[Context] label="${labelText}", type=${sectionType}, index=${sectionIndex}`);

                    // 根据上下文类型选择数据源并填充
                    let dataSource = null;
                    let filled = false;
                    
                    switch(sectionType) {
                        case 'basic':
                            // 【修改】基础信息字段允许覆盖已有值（如果简历中有更新的数据）
                            filled = fillFromDataWithOverride(input, labelText, data.basic, true);
                            if (filled) fillCount++;
                            break;
                        case 'education':
                            dataSource = data.education?.[sectionIndex];
                            break;
                        case 'internship':
                            dataSource = data.internship?.[sectionIndex];
                            break;
                        case 'workExperience':
                            dataSource = data.workExperience?.[sectionIndex];
                            break;
                        case 'project':
                            dataSource = data.project?.[sectionIndex];
                            break;
                        case 'award':
                            dataSource = data.award?.[sectionIndex];
                            break;
                        case 'competition':
                            dataSource = data.competition?.[sectionIndex];
                            break;
                        case 'language':
                            dataSource = data.language?.[sectionIndex];
                            break;
                        case 'certificate':
                            dataSource = data.certificate?.[sectionIndex];
                            break;
                        case 'familyMembers':
                            dataSource = data.familyMembers?.[sectionIndex];
                            break;
                        case 'campusLeader':
                            dataSource = data.campus?.leader?.[sectionIndex];
                            break;
                        case 'campusActivity':
                            dataSource = data.campus?.activity?.[sectionIndex];
                            break;
                        case 'volunteer':
                            dataSource = data.socialPractice?.volunteer?.[sectionIndex];
                            break;
                        case 'socialProject':
                            dataSource = data.socialPractice?.project?.[sectionIndex];
                            break;
                        case 'paper':
                            dataSource = data.professionalAchievement?.paper?.[sectionIndex];
                            break;
                        case 'patent':
                            dataSource = data.professionalAchievement?.patent?.[sectionIndex];
                            break;
                        case 'conference':
                            dataSource = data.professionalAchievement?.conference?.[sectionIndex];
                            break;
                        case 'skill':
                            filled = fillFromData(input, labelText, { description: data.skill?.description });
                            if (filled) fillCount++;
                            break;
                        case 'selfEvaluation':
                            filled = fillFromData(input, labelText, { description: data.selfEvaluation?.description });
                            if (filled) fillCount++;
                            break;
                        case 'specialNotes':
                            filled = fillFromData(input, labelText, { description: data.specialNotes?.description });
                            if (filled) fillCount++;
                            break;
                    }

                    if (dataSource) {
                        filled = fillFromData(input, labelText, dataSource);
                        if (filled) fillCount++;
                    }
                } catch (e) {
                    console.warn(`[基础填充] 处理字段时出错:`, e);
                    // 继续处理下一个字段，不中断整个流程
                    continue;
                }
            }
            
            // 每批处理完后，让出主线程，避免阻塞
            if (i + BATCH_SIZE < candidateInputs.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        console.log(`[基础填充] 成功填充 ${fillCount} 个字段`);
        return fillCount;
    }

    // ========== 辅助：从数据对象填充 ==========
    function fillFromData(input, labelText, dataObj) {
        if (!dataObj) return false;
        
        for (const key in keywords) {
            if (matchesKeyword(labelText, keywords[key])) {
                const valueToFill = dataObj[key];
                if (valueToFill && valueToFill.toString().trim() !== '') {
                    setInputValue(input, valueToFill, key);
                    return true; // 返回是否成功填充
                }
                break;
            }
        }
        return false;
    }
    
    // ========== 辅助：从数据对象填充（支持覆盖已有值）==========
    function fillFromDataWithOverride(input, labelText, dataObj, allowOverride) {
        if (!dataObj) return false;
        
        for (const key in keywords) {
            if (matchesKeyword(labelText, keywords[key])) {
                const valueToFill = dataObj[key];
                if (valueToFill && valueToFill.toString().trim() !== '') {
                    const currentValue = input.value || '';
                    
                    // 如果允许覆盖或字段为空，则填充
                    if (allowOverride || !currentValue.trim()) {
                        // 如果当前值与待填充值不同，才真正填充（避免无意义的重复操作）
                        if (currentValue !== valueToFill.toString()) {
                            console.log(`[Fill Override] ${key}: "${currentValue}" -> "${valueToFill}"`);
                            setInputValue(input, valueToFill, key);
                            return true;
                        }
                    }
                }
                break;
            }
        }
        return false;
    }

    // ========== 4. 检测字段的上下文和段落索引（优化版：减少 innerText 调用）==========
    // 缓存已解析的文本，避免重复计算
    const textCache = new WeakMap();
    
    function getElementText(element) {
        if (textCache.has(element)) {
            return textCache.get(element);
        }
        
        try {
            // 优先使用 textContent（性能更好，不会触发重排）
            // 只获取直接文本节点，避免递归获取所有子元素文本
            let text = '';
            
            // 尝试从常见的选择器获取标题文本（更快）
            const header = element.querySelector('h1, h2, h3, h4, h5, h6, legend, .title, .header, strong, label');
            if (header) {
                text = (header.textContent || '').trim();
            }
            
            // 如果没有找到标题，且元素文本不太长，才使用 textContent
            if (!text && element.textContent) {
                const fullText = element.textContent.trim();
                // 只取前 200 个字符，避免处理过长文本
                text = fullText.length > 200 ? fullText.substring(0, 200) : fullText;
            }
            
            const lowerText = text.toLowerCase();
            textCache.set(element, lowerText);
            return lowerText;
        } catch (e) {
            return '';
        }
    }
    
    // 辅助函数：检查 label 是否匹配基础信息字段
    function isBasicInfoField(labelText) {
        if (!labelText) return false;
        
        const basicFieldKeys = ['name', 'phone', 'email', 'gender', 'birthDate', 'ethnicity', 'nationality', 
                               'hometown', 'currentAddress', 'maritalStatus', 'politicalStatus', 'height', 'weight'];
        
        for (const key of basicFieldKeys) {
            if (keywords[key] && matchesKeyword(labelText, keywords[key])) {
                return true;
            }
        }
        return false;
    }
    
    function detectContextAndIndex(element, labelText) {
        // 如果没有传入 labelText，尝试获取
        if (!labelText) {
            labelText = getLabelText(element);
        }
        
        // 【优先级1】首先检查字段标签本身，如果是明确的基础信息字段，直接识别为 basic
        if (labelText) {
            // 检查是否是基础信息字段
            if (isBasicInfoField(labelText)) {
                return { type: 'basic', index: 0 };
            }
            
            // 【恢复】基于 label 的教育/实习/项目等 context 判断（但不设置 index）
            // 这样可以避免 context='unknown' 导致字段失联
            const labelLower = labelText.toLowerCase();
            
            // 教育相关
            if (['学校', '学校名称', '毕业院校', '就读院校', 'school', '专业', 'major', '学位', 'degree', '学历', 'gpa', '绩点'].some(kw => labelLower.includes(kw))) {
                return { type: 'education', index: 0 }; // index 由后续逻辑统一确定
            }
            
            // 实习/工作相关（注意排除基础信息中的"工作单位"）
            if (['公司', '单位', 'company', '职位', 'position', '岗位', '部门', 'department'].some(kw => labelLower.includes(kw))) {
                // 进一步判断是实习还是工作
                return { type: 'internship', index: 0 }; // 默认为 internship，由父容器判断
            }
            
            // 项目相关
            if (['项目名称', '项目名', 'project name', 'project'].some(kw => labelLower.includes(kw))) {
                return { type: 'project', index: 0 };
            }
            
            // 获奖相关
            if (['获奖名称', '奖项名称', '荣誉名称', 'award name', 'award'].some(kw => labelLower.includes(kw))) {
                return { type: 'award', index: 0 };
            }
            
            // 竞赛相关
            if (['赛事名称', '竞赛名称', '比赛名称', 'competition name', 'competition'].some(kw => labelLower.includes(kw))) {
                return { type: 'competition', index: 0 };
            }
            
            // 语言相关
            if (['语言', 'language', '外语'].some(kw => labelLower.includes(kw))) {
                return { type: 'language', index: 0 };
            }
            
            // 证书相关
            if (['证书名称', '证书', 'certificate'].some(kw => labelLower.includes(kw))) {
                return { type: 'certificate', index: 0 };
            }
            
            // 论文相关
            if (['论文题目', '论文名称', 'paper title', 'paper'].some(kw => labelLower.includes(kw))) {
                return { type: 'paper', index: 0 };
            }
            
            // 专利相关
            if (['专利名称', 'patent name', 'patent'].some(kw => labelLower.includes(kw))) {
                return { type: 'patent', index: 0 };
            }
        }
        
        let current = element.parentElement;
        let depth = 0;
        const maxDepth = 8; // 减少最大深度，提高性能
        let detectedType = 'unknown';
        let sectionIndex = 0;

        while (current && depth < maxDepth) {
            try {
                const text = getElementText(current);
                if (!text) {
                    current = current.parentElement;
                    depth++;
                    continue;
                }
                
                // 提取索引
                const indexPatterns = [
                    /(教育|education|学历).*?(\d+)/i,
                    /(工作|实习|intern|work|experience).*?(\d+)/i,
                    /(项目|project).*?(\d+)/i,
                    /(获奖|award|荣誉).*?(\d+)/i,
                    /(竞赛|competition).*?(\d+)/i,
                    /(语言|language).*?(\d+)/i,
                    /(证书|certificate).*?(\d+)/i,
                    /(家庭|family).*?(\d+)/i,
                    /(论文|paper).*?(\d+)/i,
                    /(专利|patent).*?(\d+)/i,
                    /(会议|conference).*?(\d+)/i,
                    /第([一二三四五六七八九十])/,
                    /#(\d+)/
                ];
                
                for (const pattern of indexPatterns) {
                    const match = text.match(pattern);
                    if (match) {
                        let idx = match[match.length - 1];
                        const chineseMap = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10};
                        if (chineseMap[idx]) idx = chineseMap[idx];
                        sectionIndex = parseInt(idx) - 1;
                        if (sectionIndex < 0) sectionIndex = 0;
                        break;
                    }
                }

                // 识别上下文类型（按优先级，使用更精确的匹配）
                // 注意：优先级从高到低，避免误判
                
                // 首先检查基本信息（提高优先级，避免被其他关键词误判）
                // 【优化】只排除明确的教育区块标题，使用完整短语匹配，避免误判
                // 【新增】增加更多基础信息区域的识别关键词
                if ((text.includes('基本') || text.includes('basic') || 
                    text.includes('个人信息') || text.includes('personal') || 
                    text.includes('contact') || text.includes('联系') ||
                    text.includes('个人资料') || text.includes('求职者信息') ||
                    text.includes('账号信息') || text.includes('我的信息') ||
                    text.includes('基本资料') || text.includes('个人简历')) &&
                    // 排除"基本信息"中的"工作单位"等字段被误判
                    !text.includes('工作经历') && !text.includes('work experience') &&
                    // 【关键修改】只排除明确的教育区块标题，而不是所有包含教育关键词的情况
                    !(text.includes('教育经历') || text.includes('教育背景') || 
                      (text.includes('education') && (text.includes('experience') || text.includes('background'))) ||
                      (text.includes('学历') && (text.includes('经历') || text.includes('背景'))))) {
                    detectedType = 'basic'; break;
                }
                
                // 专业成果子模块
                if (text.includes('论文') || text.includes('paper') || text.includes('发表')) {
                    detectedType = 'paper'; break;
                }
                if (text.includes('专利') || text.includes('patent')) {
                    detectedType = 'patent'; break;
                }
                if (text.includes('学术会议') || text.includes('conference')) {
                    detectedType = 'conference'; break;
                }
                
                // 社会实践子模块
                if (text.includes('志愿') || text.includes('volunteer') || text.includes('公益')) {
                    detectedType = 'volunteer'; break;
                }
                if (text.includes('社会实践') || text.includes('social practice')) {
                    detectedType = 'socialProject'; break;
                }
                
                // 在校经历子模块
                if (text.includes('学生干部') || text.includes('职务')) {
                    detectedType = 'campusLeader'; break;
                }
                if (text.includes('校园活动') || text.includes('campus activity')) {
                    detectedType = 'campusActivity'; break;
                }
                
                // 主要维度
                if (text.includes('竞赛') || text.includes('competition') || text.includes('比赛')) {
                    detectedType = 'competition'; break;
                }
                if (text.includes('证书') || text.includes('certificate') || text.includes('资格')) {
                    detectedType = 'certificate'; break;
                }
                if (text.includes('家庭') || text.includes('family') || text.includes('家属')) {
                    detectedType = 'familyMembers'; break;
                }
                
                // 教育经历（排除"教育行业"）
                if (text.includes('教育') || text.includes('education') || text.includes('学校') || text.includes('school') || text.includes('学历') || text.includes('degree')) {
                    if (!text.includes('行业') && !text.includes('industry')) {
                        detectedType = 'education'; break;
                    }
                }
                
                // 工作经历（优先于"工作"单独匹配）
                if (text.includes('工作经历') || text.includes('work experience') || 
                    text.includes('职业经历') || text.includes('career')) {
                    detectedType = 'workExperience'; break;
                }
                
                // 实习经历
                if (text.includes('实习') || text.includes('intern')) {
                    detectedType = 'internship'; break;
                }
                
                // 一般工作/经历（放在最后，避免误判）
                if (text.includes('工作') || text.includes('work')) {
                    // 如果是在基本信息区域，不应该识别为internship
                    // 这里保持为internship，但实际应该由上面的basic优先匹配
                    detectedType = 'internship'; break;
                }
                
                if (text.includes('项目') || text.includes('project')) {
                    detectedType = 'project'; break;
                }
                if (text.includes('获奖') || text.includes('award') || text.includes('荣誉')) {
                    detectedType = 'award'; break;
                }
                if (text.includes('语言') || text.includes('language')) {
                    detectedType = 'language'; break;
                }
                if (text.includes('技能') || text.includes('skill')) {
                    detectedType = 'skill'; break;
                }
                if (text.includes('自我评价') || text.includes('自我介绍') || text.includes('个人简介')) {
                    detectedType = 'selfEvaluation'; break;
                }
                if (text.includes('特殊说明') || text.includes('备注')) {
                    detectedType = 'specialNotes'; break;
                }
            } catch (e) {
                // 出错时继续处理下一个父元素
                console.warn(`[上下文检测] 处理元素时出错:`, e);
            }

            current = current.parentElement;
            depth++;
        }

        return { type: detectedType, index: sectionIndex };
    }

    // ========== 5. 辅助函数：获取输入框关联的文本（优化版：增强标签获取逻辑）==========
    const labelCache = new WeakMap();
    
    function getLabelText(input) {
        // 检查缓存
        if (labelCache.has(input)) {
            return labelCache.get(input);
        }
        
        let labelText = '';
        
        try {
            // 方法1: 通过 label[for] 关联
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) {
                    labelText = (label.textContent || label.innerText || '').trim();
                    if (labelText) {
                        labelCache.set(input, labelText);
                        return labelText;
                    }
                }
            }
            
            // 方法2: 查找父元素中的 label
            let parent = input.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
                const label = parent.querySelector('label');
                if (label) {
                    labelText = (label.textContent || label.innerText || '').trim();
                    if (labelText && labelText.length < 100) {
                        labelCache.set(input, labelText);
                        return labelText;
                    }
                }
                parent = parent.parentElement;
            }
            
            // 方法3: 从父元素文本中提取（使用 textContent，性能更好）
            parent = input.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
                const text = (parent.textContent || '').trim();
                if (text && text.length > 0 && text.length < 80) {
                    // 过滤掉输入框自身的值
                    if (!text.includes(input.value)) {
                        labelText = text;
                        labelCache.set(input, labelText);
                        return labelText;
                    }
                }
                parent = parent.parentElement;
            }
            
            // 方法4: 从属性中获取（增强版）
            labelText = input.getAttribute('data-label') ||  // 新增：data-label属性
                       input.getAttribute('placeholder') || 
                       input.getAttribute('name') || 
                       input.getAttribute('aria-label') || 
                       input.getAttribute('title') || 
                       '';
            
            if (labelText && labelText.length < 100) {
                labelCache.set(input, labelText);
                return labelText;
            }
            
            // 方法5: 查找相邻的文本节点（新增）
            const prevSibling = input.previousSibling;
            if (prevSibling && prevSibling.nodeType === 3) {
                const text = prevSibling.textContent.trim();
                if (text && text.length > 0 && text.length < 50) {
                    labelCache.set(input, text);
                    return text;
                }
            }
            
            // 方法6: 查找前面的兄弟元素中的文本（新增）
            let sibling = input.previousElementSibling;
            if (sibling) {
                const siblingText = (sibling.textContent || '').trim();
                if (siblingText && siblingText.length > 0 && siblingText.length < 50) {
                    // 过滤掉明显的非标签文本
                    if (!siblingText.match(/^[\d\s\-_]+$/) && !siblingText.includes('@')) {
                        labelCache.set(input, siblingText);
                        return siblingText;
                    }
                }
            }
            
        } catch (e) {
            console.warn(`[获取标签] 处理输入框时出错:`, e);
        }
        
        // 缓存空结果，避免重复查询
        labelCache.set(input, '');
        return '';
    }

    // ========== 6. 辅助函数：关键词匹配（增强版：去除标点符号）==========
    function matchesKeyword(text, keywordList) {
        // 去除空格、标点符号，提高匹配成功率
        const normalize = (str) => str.toLowerCase().replace(/[\s\-_\(\)（）【】\[\]：:、，。]+/g, '');
        const normalizedText = normalize(text);
        return keywordList.some(k => {
            const normalizedKey = normalize(k);
            // 支持完全匹配和包含匹配
            return normalizedText === normalizedKey || 
                   normalizedText.includes(normalizedKey) || 
                   normalizedKey.includes(normalizedText);
        });
    }

    // ========== 7. 辅助函数：智能赋值 ==========
    function setInputValue(input, value, type) {
        console.log(`Filling ${type} with ${value}`);
        
        if (input.type === 'radio') {
            if (input.value === value || getLabelText(input).includes(value)) {
                input.click();
            }
            return;
        }

        if (input.tagName === 'SELECT') {
            const match = findSelectOption(input, value);
            if (match) {
                input.value = match.value;
                dispatchEvents(input);
            }
            return;
        }

        // 设置值（dispatchEvents中会处理React/Vue兼容性）
        input.value = value;
        dispatchEvents(input);
    }

    // ========== 7.5. 辅助函数：下拉框模糊匹配（新增）==========
    function findSelectOption(select, value) {
        const options = Array.from(select.options);
        const normalize = (str) => str.toLowerCase().trim().replace(/[\s\-_\(\)（）【】\[\]：:、，。]+/g, '');
        const normalizedValue = normalize(String(value));
        
        // 1. 精确匹配（值和文本）
        let match = options.find(opt => {
            const optText = normalize(opt.text);
            const optValue = normalize(opt.value);
            return optText === normalizedValue || optValue === normalizedValue;
        });
        if (match) return match;
        
        // 2. 包含匹配（双向）
        match = options.find(opt => {
            const optText = normalize(opt.text);
            const optValue = normalize(opt.value);
            return optText.includes(normalizedValue) || 
                   normalizedValue.includes(optText) ||
                   optValue.includes(normalizedValue) ||
                   normalizedValue.includes(optValue);
        });
        if (match) return match;
        
        // 3. 前缀匹配（支持"本科"匹配"本科学历"）
        match = options.find(opt => {
            const optText = normalize(opt.text);
            const optValue = normalize(opt.value);
            return optText.startsWith(normalizedValue) || 
                   normalizedValue.startsWith(optText) ||
                   optValue.startsWith(normalizedValue) ||
                   normalizedValue.startsWith(optValue);
        });
        if (match) return match;
        
        // 4. 模糊匹配（去除所有标点后匹配）
        const cleanValue = normalizedValue.replace(/[^\w\u4e00-\u9fa5]/g, '');
        match = options.find(opt => {
            const cleanText = normalize(opt.text).replace(/[^\w\u4e00-\u9fa5]/g, '');
            const cleanOptValue = normalize(opt.value).replace(/[^\w\u4e00-\u9fa5]/g, '');
            return cleanText.includes(cleanValue) || 
                   cleanValue.includes(cleanText) ||
                   cleanOptValue.includes(cleanValue) ||
                   cleanValue.includes(cleanOptValue);
        });
        
        return match || null;
    }

    // ========== 8. 触发事件（增强版：改进React/Vue兼容性）==========
    function dispatchEvents(element) {
        // 先设置值（使用原生setter，确保React/Vue能检测到变化）
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, "value"
        )?.set;
        if (nativeInputValueSetter && element.value !== undefined) {
            try {
                nativeInputValueSetter.call(element, element.value);
            } catch (e) {
                // 如果失败，使用普通赋值
            }
        }
        
        // 触发事件（按顺序触发，模拟真实用户操作）
        const events = [
            { type: 'focus', bubbles: true, cancelable: true },
            { type: 'input', bubbles: true, cancelable: true },
            { type: 'change', bubbles: true, cancelable: true },
            { type: 'blur', bubbles: true, cancelable: true }
        ];
        
        events.forEach(eventConfig => {
            try {
                // 使用InputEvent和ChangeEvent以获得更好的兼容性
                let event;
                if (eventConfig.type === 'input') {
                    event = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        data: element.value
                    });
                } else if (eventConfig.type === 'change') {
                    event = new Event('change', {
                        bubbles: true,
                        cancelable: true
                    });
                } else {
                    event = new Event(eventConfig.type, {
                        bubbles: eventConfig.bubbles,
                        cancelable: eventConfig.cancelable
                    });
                }
                element.dispatchEvent(event);
            } catch (e) {
                // 如果浏览器不支持某些事件类型，使用基本Event
                const event = new Event(eventConfig.type, { bubbles: true });
                element.dispatchEvent(event);
            }
        });
    }

})();
