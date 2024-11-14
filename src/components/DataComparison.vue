<template>
  <div class="data-comparison">
    <div class="json-inputs">
      <div class="input-section">
        <h3>源数据</h3>
        <div class="textarea-container">
          <textarea
            v-model="sourceDataText"
            placeholder="请输入 JSON 格式的源数据"
          ></textarea>
          <button @click="formatJson('source')" class="format-btn">格式化</button>
        </div>
      </div>
      
      <div class="input-section">
        <h3>目标数据</h3>
        <div class="textarea-container">
          <textarea
            v-model="targetDataText"
            placeholder="请输入 JSON 格式的目标数据"
          ></textarea>
          <button @click="formatJson('target')" class="format-btn">格式化</button>
        </div>
      </div>
    </div>

    <div class="mapping-section">
      <h3>映射关系配置</h3>
      <div class="mapping-containers">
        <div class="mapping-input">
          <label>源数据字段（每行一个）</label>
          <textarea
            v-model="sourceFields"
            placeholder="请输入源数据字段，每行一个"
            @input="updateMapping"
          ></textarea>
        </div>
        <div class="mapping-input">
          <label>目标数据字段（每行一个）</label>
          <textarea
            v-model="targetFields"
            placeholder="请输入目标数据字段，每行一个"
            @input="updateMapping"
          ></textarea>
        </div>
        <div class="mapping-input">
          <label>映射结果</label>
          <textarea
            v-model="mappingResult"
            readonly
            placeholder="映射关系将在这里显示"
          ></textarea>
        </div>
      </div>
    </div>

    <button class="compare-button" @click="compareData">
      开启智能比对
    </button>

    <div class="diff-section">
      <h3>差异显示</h3>
      <div class="diff-container">
        <div class="diff-column">
          <h4>源数据</h4>
          <pre class="diff-content" v-html="formattedSourceData"></pre>
        </div>
        <div class="diff-column">
          <h4>目标数据</h4>
          <pre class="diff-content" v-html="formattedTargetData"></pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DataComparison',
  
  data() {
    return {
      sourceDataText: '',
      targetDataText: '',
      sourceFields: '',
      targetFields: '',
      mappingResult: '',
      formattedSourceData: '',
      formattedTargetData: '',
      diffPaths: new Set(),
      apiUrl: 'http://localhost:6060/api/compare/data'
    }
  },

  methods: {
    formatJson(type) {
      try {
        let text = ''
        switch(type) {
          case 'source':
            text = this.sourceDataText
            if (text) {
              const obj = JSON.parse(text)
              this.sourceDataText = JSON.stringify(obj, null, 2)
            }
            break
          case 'target':
            text = this.targetDataText
            if (text) {
              const obj = JSON.parse(text)
              this.targetDataText = JSON.stringify(obj, null, 2)
            }
            break
        }
      } catch (error) {
        alert('JSON 格式错误：' + error.message)
      }
    },

    getValueByPath(obj, path) {
      try {
        let value = obj;
        const parts = path.split('.');
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          
          if (value === null || value === undefined) {
            return undefined;
          }
          
          // 如果当前部分是数组中的对象的属性
          if (Array.isArray(value)) {
            // 遍历数组中的每个对象
            const arrayResults = value.map(item => {
              // 获取剩余路径
              const remainingPath = parts.slice(i).join('.');
              // 递归获取值
              return this.getValueByPath(item, remainingPath);
            }).filter(v => v !== undefined);
            
            // 返回找到的第一个值
            return arrayResults[0];
          }
          
          value = value[part];
        }
        
        return value;
      } catch (error) {
        console.error(`获取路径 ${path} 的值时出错:`, error);
        return undefined;
      }
    },

    formatAndHighlight(obj, isSource = true) {
      const highlight = (key, value, path = '', level = 1) => {
        const currentPath = path ? `${path}.${key}` : key;
        const indent = '  '.repeat(level);
        
        if (typeof value === 'object' && value !== null) {
          const innerIndent = '  '.repeat(level + 1);
          let inner;
          
          if (Array.isArray(value)) {
            // 处理数组
            inner = value.map((item, index) => {
              if (typeof item === 'object' && item !== null) {
                // 如果数组元素是对象，递归处理
                const objEntries = Object.entries(item).map(([k, v]) => {
                  return innerIndent + '  ' + highlight(k, v, `${currentPath}`, level + 2);
                }).join(',\n');
                return `${innerIndent}{\n${objEntries}\n${innerIndent}}`;
              } else {
                return innerIndent + JSON.stringify(item);
              }
            }).join(',\n');
            return `"${key}": [\n${inner}\n${indent}]`;
          } else {
            // 处理对象
            inner = Object.entries(value).map(([k, v]) => {
              return innerIndent + highlight(k, v, currentPath, level + 1);
            }).join(',\n');
            return `"${key}": {\n${inner}\n${indent}}`;
          }
        } else {
          // 处理基本类型值
          const isDifferent = this.diffPaths.has(currentPath);
          let displayValue = value;
          
          if (typeof value === 'string') {
            displayValue = `"${this.escapeHtml(value)}"`;
          } else if (value === null) {
            displayValue = 'null';
          } else {
            displayValue = String(value);
          }
          
          const className = isDifferent ? 'diff-highlight' : '';
          return `"${key}": <span class="${className}">${displayValue}</span>`;
        }
      };

      try {
        const formatted = Object.entries(obj).map(([key, value]) => {
          return '  ' + highlight(key, value);
        }).join(',\n');
        
        return `{\n${formatted}\n}`;
      } catch (error) {
        console.error('格式化错误:', error);
        return '';
      }
    },

    escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    findDifferences(sourceObj, targetObj, path = '') {
      if (typeof sourceObj !== typeof targetObj) {
        this.diffPaths.add(path);
        return;
      }

      if (typeof sourceObj === 'object' && sourceObj !== null) {
        if (Array.isArray(sourceObj)) {
          // 处理数组
          sourceObj.forEach((item, index) => {
            if (targetObj[index]) {
              this.findDifferences(item, targetObj[index], 
                path ? `${path}[${index}]` : `[${index}]`);
            }
          });
        } else {
          // 处理对象
          Object.keys(sourceObj).forEach(key => {
            const newPath = path ? `${path}.${key}` : key;
            if (key in targetObj) {
              this.findDifferences(sourceObj[key], targetObj[key], newPath);
            }
          });
        }
      } else if (JSON.stringify(sourceObj) !== JSON.stringify(targetObj)) {
        this.diffPaths.add(path);
      }
    },

    async compareData() {
      try {
        const sourceObj = JSON.parse(this.sourceDataText)
        const targetObj = JSON.parse(this.targetDataText)
        
        const mappings = this.sourceFields.split('\n')
          .filter(field => field.trim())
          .map((sourcePath, index) => ({
            sourcePath: sourcePath.trim(),
            targetPath: this.targetFields.split('\n')[index].trim()
          }))
          .filter(mapping => mapping.sourcePath && mapping.targetPath)

        const requestData = {
          sourceData: this.sourceDataText,
          targetData: this.targetDataText,
          mappings: mappings
        }

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        })

        const result = await response.json()

        if (result.success) {
          this.diffPaths.clear()
          
          Object.keys(result.differences).forEach(path => {
            this.diffPaths.add(path)
          })
          
          this.formattedSourceData = this.formatAndHighlight(sourceObj[0], true)
          this.formattedTargetData = this.formatAndHighlight(targetObj[0], false)
        } else {
          alert('比对失败：' + result.message)
        }
        
      } catch (error) {
        alert('比对过程出错：' + error.message)
      }
    },

    updateMapping() {
      const sourceArray = this.sourceFields.split('\n').filter(field => field.trim())
      const targetArray = this.targetFields.split('\n').filter(field => field.trim())
      const length = Math.min(sourceArray.length, targetArray.length)
      
      let mappings = []
      for (let i = 0; i < length; i++) {
        if (sourceArray[i] && targetArray[i]) {
          mappings.push(`${sourceArray[i].trim().padEnd(80)}  →  ${targetArray[i].trim()}`)
        }
      }
      
      this.mappingResult = mappings.join('\n')
    },

    formatValue(value) {
      if (typeof value === 'string') {
        try {
          // 尝试解码可能的 URI 编码
          return decodeURIComponent(value);
        } catch (e) {
          return value;
        }
      }
      return value;
    }
  }
}
</script>

<style scoped>
.data-comparison {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.json-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.input-section {
  width: 100%;
}

.textarea-container {
  position: relative;
  margin-bottom: 20px;
}

textarea {
  width: 100%;
  min-height: 200px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.4;
  resize: vertical;
}

.format-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 1;
}

.mapping-section {
  margin: 20px 0;
}

.mapping-containers {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  gap: 20px;
  margin-bottom: 20px;
}

.mapping-input {
  display: flex;
  flex-direction: column;
}

.mapping-input label {
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.mapping-input textarea {
  height: 150px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: 'Microsoft YaHei', 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.4;
  resize: both;
  min-width: 200px;
  min-height: 150px;
}

.mapping-input textarea[readonly] {
  background-color: #f5f5f5;
}

.compare-button {
  background-color: #1890ff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  margin: 20px 0;
}

.compare-button:hover {
  background-color: #40a9ff;
}

.diff-section {
  margin-top: 20px;
}

button {
  padding: 8px 16px;
  background-color: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
}

button:hover {
  background-color: #40a9ff;
}

.remove-btn {
  background-color: #ff4d4f;
}

.remove-btn:hover {
  background-color: #ff7875;
}

h3 {
  margin-bottom: 10px;
  color: #333;
}

.mapping-input:last-child textarea {
  width: 100%;
  overflow-y: auto;
  overflow-x: auto;
  white-space: pre;
  min-width: 600px;
  background-color: #f8f8f8;
  font-family: 'Courier New', Courier, monospace;
  line-height: 1.6;
  padding: 12px;
}

.mapping-input textarea::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.mapping-input textarea::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 5px;
}

.mapping-input textarea::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 5px;
  border: 2px solid #f1f1f1;
}

.mapping-input textarea::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.mapping-input textarea::-webkit-scrollbar-corner {
  background: #f1f1f1;
}

/* 确保中文字体正确显示 */
* {
  font-family: 'Microsoft YaHei', Arial, sans-serif;
}

.diff-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 20px;
}

.diff-column {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 20px;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.diff-column h4 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.diff-content {
  white-space: pre;  /* 改为 pre 以保持格式 */
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Microsoft YaHei', monospace;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
  margin: 0;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 4px;
  tab-size: 2;
  -moz-tab-size: 2;
}

/* 差异高亮样式 */
:deep(.diff-highlight) {
  background-color: #ffebee;
  color: #f44336;
  padding: 2px 4px;
  border-radius: 2px;
  display: inline-block;  /* 确保高亮背景完整显示 */
}

/* JSON 键值对样式 */
.diff-content span {
  display: inline-block;
  line-height: 1.6;
}

/* 添加行号背景色交替效果 */
.diff-content {
  background-image: linear-gradient(
    to bottom,
    #ffffff 50%,
    #f8f8f8 50%
  );
  background-size: 100% 3.2em;
  background-position: 0 0;
}

/* 自定义滚动条样式优化 */
.diff-content::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.diff-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.diff-content::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 4px;
  border: 2px solid #f1f1f1;
}

.diff-content::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style> 