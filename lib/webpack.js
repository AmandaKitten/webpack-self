const fs = require("fs");
const path = require("path");

const parser = require("@babel/parser")
const traverse = require("@babel/traverse").default;

const {transformFromAst} = require("@babel/core")

module.exports = class webpack {
    constructor(options) {
        // console.log(options);
        const { entry, output } = options;
        this.entry = entry;
        this.output = output;
        this.module = [];
    }
    run() {
        //分析入口模块
        const info = this.parse(this.entry)
        // console.log(info);
        this.module.push(info);
        for (let i = 0; i < this.module.length; i++) {
            const item = this.module[i];
            const {dependencies} = item;
            if ( dependencies) {
                for (let j in dependencies) {
                    this.module.push( this.parse(dependencies[j]));
                }
            }
        }
        // console.log(this.module);  // 数组对象
        const obj = {};
        this.module.forEach((item) => {
            obj[item.entryFile] = {
                dependencies: item.dependencies,
                code: item.code
            }
        })
        // console.log(obj);  //数组转obj
        this.file(obj)
        }
    parse(entryFile) {
        // console.log(entryFile); //./src/index.js
        const content = fs.readFileSync(entryFile, "utf-8")
        // console.log(content); //entry 入口文件内容
        const ast = parser.parse(content, {
            sourceType: "module",
        })
        // console.log(ast.program.body);
        const dependencies = {}
        traverse(ast,{
            ImportDeclaration({node}){
                // console.log(node.source.value );//"./a.js"
                // "./a.js => ./src/a.js"
                // path.sep: 添加平台特定分隔符
                const newPahtName = "."+ path.sep + path.join(path.dirname(entryFile), node.source.value)
                // console.log("."+ path.sep + newPahtName); // .\src\a.js
                dependencies[node.source.value] = newPahtName;
            }
        })
        const { code } = transformFromAst(ast, null , {
            presets: ["@babel/preset-env"] 
        }) 
        // console.log(dependencies); //{ './a.js': '.\\src\\a.js', './b.js': '.\\src\\b.js' }
        return {
            entryFile,
            dependencies,
            code
        }
    }
    file (code) {
        //创建自运行函数，处理require,module,exports
        //生成main.js => dist/main.js
        const filePath = path.join(this.output.path, this.output.fileName)
        // console.log(filePath); //输出路径 C:\Users\AmandaKitten\workspace\vscodeProject\webpack-self\dist\main.js
        const newCode = JSON.stringify(code);
        const bundle = `(function (graph) {
            function require(module) {
                function reRequire (relativePath) {
                    return require ( graph[module].dependencies[relativePath])
                }
                var exports = {};
                (function (require, exports, code) {
                    eval (code)
                })(reRequire, exports, graph[module].code)
                return exports
            }
            require('${this.entry}')
        })(${newCode})`;
        fs.writeFileSync(filePath, bundle, "utf-8")
    }
}