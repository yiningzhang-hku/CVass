(function() {
    console.log("JobAutoFill: 开始运行...");

    // 1. 定义同义词词典 (Synonym Map)
    const keywords = {
        // 基本信息
        name: ['姓名', 'name', 'full name', '中文名'],
        phone: ['手机', '电话', 'phone', 'mobile', 'cellphone'],
        email: ['邮箱', 'email', 'mail', '电子邮箱'],
        gender: ['性别', 'gender', 'sex'],
        
        // 教育经历 (通常只处理第一段教育经历，高级版需处理多段)
        school: ['学校', 'school', 'university', '毕业院校', 'college'],
        major: ['专业', 'major', 'discipline'],
        degree: ['学历', '学位', 'degree', 'education level'],
        gpa: ['绩点', 'gpa', '成绩', 'score'],
        college: ['院系', '学院', 'department', 'academy'],
        startTime: ['开始时间', '入学时间', 'start date', 'from'],
        endTime: ['结束时间', '毕业时间', 'end date', 'to'],

        // 实习/工作
        company: ['公司', 'company', 'employer', '单位'],
        position: ['职位', '岗位', 'position', 'job title', 'role'],
        description: ['描述', '内容', 'description', 'responsibility', 'duty']
    };

    // 2. 从 Storage 读取数据
    chrome.storage.local.get(['profile'], (result) => {
        if (!result.profile) {
            alert("请先在插件弹窗中填写简历信息！");
            return;
        }
        autoFill(result.profile);
    });

    // 3. 主填充逻辑
    function autoFill(data) {
        const inputs = document.querySelectorAll('input, select, textarea');
        
        // 将复杂的数据扁平化，方便优先匹配 (这里简化处理，优先填入第一段经历)
        // 实际场景中，需要检测网页是否存在"添加教育经历"的按钮并点击，或者识别教育经历区块
        const flatData = {
            ...data.basic,
            // 简单策略：将第一段教育经历的字段合并
            ...(data.education && data.education[0] ? {
                school: data.education[0].school,
                major: data.education[0].major,
                degree: data.education[0].degree,
                gpa: data.education[0].gpa,
                college: data.education[0].college,
                startTime: data.education[0].start,
                endTime: data.education[0].end
            } : {}),
            // 简单策略：将第一段实习合并
            ...(data.internship && data.internship[0] ? {
                company: data.internship[0].company,
                position: data.internship[0].position,
                description: data.internship[0].description
            } : {})
        };

        inputs.forEach(input => {
            // 只有未填写的才填充，避免覆盖用户已填内容
            if (input.value && input.value.trim() !== "") return;

            // 获取输入框周边的标签文本
            const labelText = getLabelText(input);
            if (!labelText) return;

            // 匹配字段
            for (const key in keywords) {
                if (matchesKeyword(labelText, keywords[key])) {
                    // 找到匹配的字段，尝试赋值
                    const valueToFill = flatData[key];
                    if (valueToFill) {
                        setInputValue(input, valueToFill, key);
                    }
                    break; 
                }
            }
        });
    }

    // 4. 辅助函数：获取输入框关联的文本 (Label识别)
    function getLabelText(input) {
        // 策略A: 标准 <label for="id">
        if (input.id) {
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) return label.innerText;
        }
        // 策略B: 父级元素包含文本 (常见于 <div><span>姓名</span><input></div>)
        let parent = input.parentElement;
        for (let i = 0; i < 3; i++) { // 向上查找3层
            if (parent) {
                const text = parent.innerText;
                // 移除input自身的值对innerText的影响（虽然input通常为空，但防万一）
                if (text && text.length < 50) { // 防止获取到整个大段落
                    return text;
                }
                parent = parent.parentElement;
            }
        }
        // 策略C: Placeholder 或 Name 属性
        return input.getAttribute('placeholder') || input.getAttribute('name') || "";
    }

    // 5. 辅助函数：关键词匹配
    function matchesKeyword(text, keywordList) {
        const lowerText = text.toLowerCase().replace(/\s+/g, ''); // 去除空格转小写
        return keywordList.some(k => lowerText.includes(k.toLowerCase()));
    }

    // 6. 辅助函数：智能赋值 (处理React/Vue等框架的事件绑定)
    function setInputValue(input, value, type) {
        console.log(`Filling ${type} with ${value}`);
        
        // 处理单选框 (Radio)
        if (input.type === 'radio') {
            // 假设 value 是 "男"，尝试匹配 label 或 value 属性
            if (input.value === value || getLabelText(input).includes(value)) {
                input.click();
            }
            return;
        }

        // 处理下拉框 (Select)
        if (input.tagName === 'SELECT') {
            const options = Array.from(input.options);
            const normalizedValue = value.toLowerCase().trim();
            
            // 优先查找完全匹配的选项
            // 完全匹配：选项文本或值完全等于目标值，或者选项文本以目标值开头（如"香港大学"匹配"香港大学/The University of Hong Kong"）
            const exactMatch = options.find(opt => {
                const optText = opt.text.toLowerCase().trim();
                const optValue = opt.value.toLowerCase().trim();
                // 完全相等
                if (optText === normalizedValue || optValue === normalizedValue) {
                    return true;
                }
                // 选项文本以目标值开头（处理"香港大学/The University of Hong Kong"这种情况）
                if (optText.startsWith(normalizedValue + '/') || optText.startsWith(normalizedValue + ' /')) {
                    return true;
                }
                // 选项文本以目标值开头后跟其他分隔符
                if (optText.startsWith(normalizedValue + '（') || optText.startsWith(normalizedValue + '(')) {
                    return true;
                }
                return false;
            });
            
            if (exactMatch) {
                input.value = exactMatch.value;
                dispatchEvents(input);
            }
            // 如果没有完全匹配，不选择任何选项（留空）
            return;
        }

        // 处理普通文本框 (Text / Date / Textarea)
        // 针对 React/Vue 的特殊处理：直接修改 value 属性可能不会触发数据绑定
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if(nativeInputValueSetter) {
             nativeInputValueSetter.call(input, value);
        } else {
             input.value = value;
        }
        
        dispatchEvents(input);
    }

    // 7. 触发事件 (模拟用户输入，激活网页脚本的校验)
    function dispatchEvents(element) {
        const events = ['input', 'change', 'blur', 'focus'];
        events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            element.dispatchEvent(event);
        });
    }

})();