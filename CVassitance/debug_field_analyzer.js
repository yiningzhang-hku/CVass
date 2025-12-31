(function() {
    console.log("JobAutoFill Debug: 开始字段问题分析...");

    // ===== 1. 同义词词典（与 content.js 保持一致，便于复用匹配逻辑） =====
    const keywords = {
        // ===== 基本信息 =====
        name: ['姓名', 'name', 'full name', '中文名', '真实姓名'],
        phone: ['手机', '电话', 'phone', 'mobile', 'cellphone', '联系电话', '手机号'],
        email: ['邮箱', 'email', 'mail', '电子邮箱', 'e-mail'],
        gender: ['性别', 'gender', 'sex'],
        birthDate: ['出生日期', 'birth', 'birthday', '出生年月', '生日'],
        ethnicity: ['民族', 'ethnicity', 'ethnic'],
        nationality: ['国籍', 'nationality', 'citizenship'],
        hometown: ['户籍', 'hometown', '籍贯', '户口所在地', '户籍所在'],
        currentAddress: ['现居', 'current address', '居住地', '现住址', '目前住址'],
        maritalStatus: ['婚姻', 'marital', '婚姻状况', 'married'],
        politicalStatus: ['政治面貌', 'political', '党派', '政治'],
        height: ['身高', 'height'],
        weight: ['体重', 'weight'],
        
        // ===== 教育经历 =====
        school: ['学校', 'school', 'university', '毕业院校', 'college', '院校', '就读院校'],
        major: ['专业', 'major', 'discipline', '所学专业'],
        degree: ['学历', '学位', 'degree', 'education level', '最高学历'],
        gpa: ['绩点', 'gpa', '平均分'],
        scorePercent: ['百分制', '成绩', 'score', '均分'],
        college: ['院系', '学院', 'department', 'academy', 'faculty'],
        startDate: ['开始时间', '入学时间', 'start date', 'from', '起始时间', '开始日期'],
        endDate: ['结束时间', '毕业时间', 'end date', 'to', '截止时间', '结束日期'],
        schoolSystem: ['学制', 'duration', '年制'],
        status: ['状态', 'status', '在读', '毕业'],
        eduType: ['学历性质', '全日制', '非全日制', 'education type'],
        lab: ['实验室', 'lab', 'laboratory'],
        advisor: ['导师', '指导教师', 'advisor', 'supervisor'],
        thesisTitle: ['论文题目', '毕业设计', 'thesis', '毕业论文'],
        thesisAdvisor: ['论文导师', 'thesis advisor'],
        minorSchool: ['辅修院校', 'minor school', '双学位院校'],
        minorDegree: ['辅修学位', 'minor degree', '双学位'],
        exchangeSchool: ['交换院校', '留学院校', 'exchange school', '海外院校'],
        exchangeDate: ['交换时间', 'exchange date', '留学时间'],
        exchangeCourse: ['交换课程', 'exchange course', '修读课程'],

        // ===== 实习/工作经历 =====
        company: ['公司', 'company', 'employer', '单位', '工作单位', '企业'],
        department: ['部门', 'department', '所属部门'],
        position: ['职位', '岗位', 'position', 'job title', 'role', '职务'],
        description: ['描述', '内容', 'description', 'responsibility', 'duty', '工作内容', '职责'],

        // ===== 项目经历 =====
        projectName: ['项目名称', 'project name', '项目名'],
        role: ['角色', 'role', '担任角色', '项目角色'],

        // ===== 获奖经历 =====
        awardType: ['获奖类型', 'award type', '奖项类型', '获奖级别'],
        awardName: ['获奖名称', 'award name', '奖项名称', '荣誉名称'],
        awardDate: ['获奖时间', 'award date', '获奖日期'],

        // ===== 竞赛经历 =====
        competitionName: ['赛事名称', 'competition name', '竞赛名称', '比赛名称'],
        competitionLevel: ['赛事级别', 'competition level', '竞赛级别'],
        competitionAward: ['奖项', 'prize', '比赛奖项', '竞赛成绩'],
        teamRole: ['团队角色', 'team role', '队内职责'],

        // ===== 语言能力 =====
        language: ['语言', 'language', '外语'],
        languageScore: ['成绩', 'score', '等级', '分数', 'level'],

        // ===== 专业资格证书 =====
        certificateName: ['证书名称', 'certificate name', '资格证书', '证书'],
        certificateDate: ['取得时间', 'certificate date', '获证时间'],

        // ===== 家庭成员 =====
        familyName: ['姓名', 'name', '家属姓名'],
        relation: ['关系', 'relation', '与本人关系', '亲属关系'],
        familyPhone: ['联系方式', 'phone', '家属电话'],
        familyCompany: ['工作单位', 'company', '家属单位'],
        familyPosition: ['职务', 'position', '家属职务'],

        // ===== 专业成果 - 论文 =====
        paperTitle: ['论文题目', 'paper title', '论文名称', '文章标题'],
        journal: ['期刊', 'journal', '期刊名称', '发表刊物'],
        authorOrder: ['作者排序', 'author order', '作者顺位', '排名'],
        doi: ['doi', 'DOI', '链接'],

        // ===== 专业成果 - 专利 =====
        patentName: ['专利名称', 'patent name', '专利'],
        patentNumber: ['专利号', 'patent number', '申请号'],
        patentType: ['专利类型', 'patent type', '类型'],
        patentStatus: ['授权状态', 'patent status', '状态'],
        patentRole: ['本人角色', 'inventor', '发明人'],

        // ===== 专业成果 - 学术会议 =====
        conferenceName: ['会议名称', 'conference name', '学术会议'],
        topic: ['演讲主题', 'topic', '主题', '报告题目'],
        conferenceDate: ['会议时间', 'conference date'],

        // ===== 在校经历 =====
        leaderPosition: ['职务名称', 'position', '干部职务', '学生干部'],
        activityName: ['活动名称', 'activity name', '活动'],

        // ===== 社会实践 =====
        organization: ['公益组织', 'organization', '志愿组织', '机构'],
        duty: ['职责', 'duty', '工作职责'],
        hours: ['服务时长', 'hours', '志愿时长', '小时'],
        practiceProject: ['项目名称', 'project name', '实践项目'],
        result: ['成果', 'result', '成果描述', '项目成果'],

        // ===== 技能/自我评价/特殊说明 =====
        skillDescription: ['技能', 'skill', '专业技能', '技术能力'],
        selfEvaluation: ['自我评价', 'self evaluation', '个人简介', '自我介绍', '个人总结'],
        specialNotes: ['特殊说明', 'special notes', '备注', '其他说明']
    };

    // ===== 2. 辅助：从 label/placeholder 等获取字段文案 =====
    function getLabelText(input) {
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.innerText;
        }
        let parent = input.parentElement;
        for (let i = 0; i < 4; i++) {
            if (parent) {
                const text = parent.innerText;
                if (text && text.length < 80) {
                    return text;
                }
                parent = parent.parentElement;
            }
        }
        return input.getAttribute('placeholder') ||
               input.getAttribute('name') ||
               input.getAttribute('aria-label') || "";
    }

    // ===== 3. 关键词匹配（与 content.js 一致） =====
    function matchesKeyword(text, keywordList) {
        const lowerText = (text || '').toLowerCase().replace(/\s+/g, '');
        return keywordList.some(k => lowerText.includes(k.toLowerCase()));
    }

    // ===== 4. 上下文与段落索引识别（复用 content.js 的逻辑，简化版） =====
    function detectContextAndIndex(element) {
        let current = element.parentElement;
        let depth = 0;
        const maxDepth = 10;
        let detectedType = 'unknown';
        let sectionIndex = 0;

        while (current && depth < maxDepth) {
            const text = (current.innerText || '').toLowerCase();

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
                    const chineseMap = {
                        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
                        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
                    };
                    if (chineseMap[idx]) idx = chineseMap[idx];
                    sectionIndex = parseInt(idx, 10) - 1;
                    if (sectionIndex < 0 || isNaN(sectionIndex)) sectionIndex = 0;
                    break;
                }
            }

            // 上下文类型识别（与 content.js 一致的优先级）
            if (text.includes('论文') || text.includes('paper') || text.includes('发表')) {
                detectedType = 'paper'; break;
            }
            if (text.includes('专利') || text.includes('patent')) {
                detectedType = 'patent'; break;
            }
            if (text.includes('学术会议') || text.includes('conference')) {
                detectedType = 'conference'; break;
            }
            if (text.includes('志愿') || text.includes('volunteer') || text.includes('公益')) {
                detectedType = 'volunteer'; break;
            }
            if (text.includes('社会实践') || text.includes('social practice')) {
                detectedType = 'socialProject'; break;
            }
            if (text.includes('学生干部') || text.includes('职务')) {
                detectedType = 'campusLeader'; break;
            }
            if (text.includes('校园活动') || text.includes('campus activity')) {
                detectedType = 'campusActivity'; break;
            }
            if (text.includes('竞赛') || text.includes('competition') || text.includes('比赛')) {
                detectedType = 'competition'; break;
            }
            if (text.includes('证书') || text.includes('certificate') || text.includes('资格')) {
                detectedType = 'certificate'; break;
            }
            if (text.includes('家庭') || text.includes('family') || text.includes('家属')) {
                detectedType = 'familyMembers'; break;
            }
            if (text.includes('教育') || text.includes('education') || text.includes('学校')) {
                detectedType = 'education'; break;
            }
            if (text.includes('实习') || text.includes('intern')) {
                detectedType = 'internship'; break;
            }
            if (text.includes('工作经历') || text.includes('work experience')) {
                detectedType = 'workExperience'; break;
            }
            if (text.includes('工作') || text.includes('work')) {
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
            if (text.includes('基本') || text.includes('basic') || text.includes('个人信息')) {
                detectedType = 'basic'; break;
            }

            current = current.parentElement;
            depth++;
        }

        return { type: detectedType, index: sectionIndex };
    }

    // ===== 5. 根据 context/index 从 profile 中取对应数据段 =====
    function getDataSourceByContext(profile, ctx) {
        const t = ctx.type;
        const i = ctx.index;
        if (!profile) return null;

        switch (t) {
            case 'basic':
                return profile.basic;
            case 'education':
                return profile.education && profile.education[i];
            case 'internship':
                return profile.internship && profile.internship[i];
            case 'workExperience':
                return profile.workExperience && profile.workExperience[i];
            case 'project':
                return profile.project && profile.project[i];
            case 'award':
                return profile.award && profile.award[i];
            case 'competition':
                return profile.competition && profile.competition[i];
            case 'language':
                return profile.language && profile.language[i];
            case 'certificate':
                return profile.certificate && profile.certificate[i];
            case 'familyMembers':
                return profile.familyMembers && profile.familyMembers[i];
            case 'campusLeader':
                return profile.campus && profile.campus.leader && profile.campus.leader[i];
            case 'campusActivity':
                return profile.campus && profile.campus.activity && profile.campus.activity[i];
            case 'volunteer':
                return profile.socialPractice && profile.socialPractice.volunteer && profile.socialPractice.volunteer[i];
            case 'socialProject':
                return profile.socialPractice && profile.socialPractice.project && profile.socialPractice.project[i];
            case 'paper':
                return profile.professionalAchievement && profile.professionalAchievement.paper && profile.professionalAchievement.paper[i];
            case 'patent':
                return profile.professionalAchievement && profile.professionalAchievement.patent && profile.professionalAchievement.patent[i];
            case 'conference':
                return profile.professionalAchievement && profile.professionalAchievement.conference && profile.professionalAchievement.conference[i];
            case 'skill':
                return profile.skill ? { description: profile.skill.description } : null;
            case 'selfEvaluation':
                return profile.selfEvaluation ? { description: profile.selfEvaluation.description } : null;
            case 'specialNotes':
                return profile.specialNotes ? { description: profile.specialNotes.description } : null;
            default:
                return null;
        }
    }

    // ===== 6. 主分析逻辑 =====
    function analyzeFields(profile) {
        const inputs = document.querySelectorAll('input, select, textarea');
        const report = [];

        inputs.forEach((input, idx) => {
            if (input.type === 'hidden' || input.disabled || input.offsetParent === null) return;

            const labelText = getLabelText(input) || "";
            const ctxInfo = detectContextAndIndex(input);
            const dataSource = getDataSourceByContext(profile, ctxInfo);

            let matchedKey = null;
            let profileValue = null;

            if (dataSource) {
                for (const key in keywords) {
                    if (matchesKeyword(labelText, keywords[key])) {
                        matchedKey = key;
                        profileValue = dataSource[key];
                        break;
                    }
                }
            }

            const issues = [];

            if (ctxInfo.type === 'unknown') {
                issues.push('CONTEXT_UNKNOWN: 无法从父级文案识别所属模块');
            }

            if (!dataSource) {
                issues.push('NO_DATA_SOURCE: 根据 context/index 在 profile 中找不到对应段（简历未填或下标越界）');
            }

            if (dataSource && !matchedKey) {
                issues.push('LABEL_NOT_MATCHED: 有对应段数据，但标签未命中任何简历字段（同义词表未匹配）');
            }

            if (matchedKey && (profileValue === undefined || profileValue === null || String(profileValue).trim() === '')) {
                issues.push('PROFILE_FIELD_EMPTY: 已匹配字段，但该字段在简历数据中为空');
            }

            if (input.tagName === 'SELECT') {
                const currentValue = (input.value || '').trim();
                if (currentValue && currentValue !== '0' && currentValue !== '-1') {
                    issues.push('SKIP_PROTECTED_SELECT: 下拉框已有非默认选项，填充逻辑会跳过');
                } else if (profileValue) {
                    const options = Array.from(input.options);
                    const normalizedValue = String(profileValue).toLowerCase().trim();
                    const exactMatch = options.find(opt => {
                        const optText = opt.text.toLowerCase().trim();
                        const optValue = opt.value.toLowerCase().trim();
                        if (optText === normalizedValue || optValue === normalizedValue) return true;
                        if (optText.startsWith(normalizedValue + '/') || optText.startsWith(normalizedValue + '（')) return true;
                        return false;
                    });
                    if (!exactMatch) {
                        issues.push('SELECT_NO_MATCH_OPTION: 简历值与下拉选项无法匹配');
                    }
                }
            } else {
                const currentValue = (input.value || '').trim();
                if (currentValue) {
                    issues.push('SKIP_PROTECTED_EXISTING: 字段已存在非空值，填充逻辑会跳过');
                }
            }

            if (issues.length) {
                report.push({
                    index: idx,
                    tag: input.tagName,
                    type: input.type,
                    id: input.id,
                    name: input.name,
                    label: labelText.trim(),
                    contextType: ctxInfo.type,
                    sectionIndex: ctxInfo.index,
                    matchedKey,
                    profileValue,
                    issues
                });
            }
        });

        console.log('JobAutoFill Debug: 问题字段分析结果如下 ↓↓↓');
        console.table(report.map(r => ({
            idx: r.index,
            tag: r.tag,
            type: r.type,
            id: r.id,
            name: r.name,
            label: r.label,
            context: r.contextType + '[' + r.sectionIndex + ']',
            matchedKey: r.matchedKey,
            profileValue: r.profileValue,
            issues: r.issues.join(' | ')
        })));

        // 暴露在 window 上，方便在控制台里手动查看原始结构
        window.JobAutoFillDebugReport = report;

        // 发送结果到 popup（如果 popup 在监听）
        try {
            chrome.runtime.sendMessage({
                action: 'DEBUG_REPORT',
                report: report,
                summary: {
                    total: report.length,
                    contextUnknown: report.filter(r => r.issues.includes('CONTEXT_UNKNOWN')).length,
                    noDataSource: report.filter(r => r.issues.includes('NO_DATA_SOURCE')).length,
                    labelNotMatched: report.filter(r => r.issues.includes('LABEL_NOT_MATCHED')).length,
                    profileFieldEmpty: report.filter(r => r.issues.includes('PROFILE_FIELD_EMPTY')).length,
                    selectNoMatch: report.filter(r => r.issues.includes('SELECT_NO_MATCH_OPTION')).length,
                    skipProtected: report.filter(r => r.issues.some(i => i.includes('SKIP_PROTECTED'))).length
                }
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('JobAutoFill Debug: popup 未监听，仅在 Console 显示');
                }
            });
        } catch (e) {
            console.log('JobAutoFill Debug: 无法发送到 popup，仅在 Console 显示');
        }
    }

    // ===== 7. 从 storage 读取 profile 后执行分析 =====
    chrome.storage.local.get(['profile'], (result) => {
        if (!result.profile) {
            console.warn('JobAutoFill Debug: 未找到 profile，请先在弹窗中填写并保存简历数据');
            return;
        }
        analyzeFields(result.profile);
    });

})();