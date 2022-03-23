// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "LEAVE" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.genApiTypes', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from hello-world!');
		vscode.window.showInputBox({
			placeHolder: '请输入将要生成的类型名字'
		}).then(typeName => {
			vscode.window.activeTextEditor?.edit(editBuilder => {
				const selection = vscode.window.activeTextEditor?.selection;
				if (selection) {
		
					const editor = vscode.window.activeTextEditor;
					if (editor) {
						let { start, end } = editor.selection;
						let highlight = editor.document.getText(new vscode.Range(start, end));
						try {
							const targetStr = raw2ApiType(highlight, typeName);
							console.log('选中的字符串', highlight);
							console.log('转换',targetStr );
							editBuilder.replace(selection, targetStr);
						} catch (error) {
							console.error(error);
							
							vscode.window.showErrorMessage('无效的字符串，转换api type失败');
						}
					}
		
				}
			});
		});

	});



	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}


/**
 * 
 * 
Action	是	String	公共参数，本接口取值：CreateFile。
Version	是	String	公共参数，本接口取值：2021-07-28。
Region	否	String	公共参数，本接口不需要传递此参数。
FileId	是	String	文件 ID
ProjectId	是	String	项目 ID
Kind	是	Integer	文件种类，参数文件-0，协议文件-1，请求文件-2
Name	是	String	文件名
Size	是	Integer	文件大小
Type	是	String	文件类型，文件夹-folder
UpdateAt	是	Timestamp ISO8601	更新时间
LineCount	否	Integer	行数
HeadLines.N	否	Array of String	前几行数据
TailLines.N	否	Array of String	后几行数据
HeaderInFile	否	Boolean	表头是否在文件内
HeaderColumns.N	否	Array of String	表头
FileInfos.N	否	Array of FileInfo	文件夹中的文件 
 * 
 */

function genType(rawType: string) {
	const map: Record<string, string> = {
		'String': 'string',
		'Integer': 'number',
		'Boolean': 'boolean',
		'String[]': 'string[]',
		'Integer[]': 'number[]',
		'Boolean[]': 'boolean[]',
	};

	const rs = map[rawType];
	const extra =  rs ? '' : `\ntype ${rawType.replace('[]', '')} = {};\n`;
	return [rs ?? rawType, extra];
}

// const REG_ENG = /[a-zA-Z\s]+/g;
// const REG_CN = /$[\u4e00-\u9fa5]+/;
function isHeader(line: string) {
	return /^[\u4e00-\u9fa5]+/.test(line) && line.includes('\t');
}

function parseLine(lineStr: string): any[] {
	const result: any[] = [];
	const matches = lineStr.split('\t');

	matches.forEach(rs => {
		if (!rs) { return; };
		rs = rs.trim();
		if (['是', '否'].includes(rs)) { // required
			return result.push(rs === '是');
		}

		if (rs.includes('Array of')) {rs = rs.split(' ').pop() + '[]';}
		if (rs.includes('.N')) {rs = rs.replace('.N', '');}
		if (rs.includes('Timestamp ISO8601')) {rs = 'String';} 
		result.push(rs);
	});
	
	// let matches: any;
	// while(matches = REG_ENG.test(lineStr) || (matches = REG_CN.test(lineStr))) {
	// 	let rs: string = matches[0];
	// 	if (!rs) { continue; };
	// 	if (rs.includes('Array of')) {rs = rs.split('').pop() + '[]';}
	// 	if (rs.endsWith('.N')) {rs = rs.replace('.N', '');}
	// 	if (rs.includes('Timestamp ISO8601')) {rs = 'String';} 
	// 	matches[0] && result.push(matches[0]);
	// }

	return result;
}

function raw2ApiType(rawStr: string, typeName = 'SomeType') {
	const lines = rawStr.trim().split('\n');

	const configs: any[] = [];
	const headers = genHeaders(lines[0]);
	lines.forEach((line) => {
		if (!line) {return;} // 移除空行

		// 移除表头
		if (isHeader(line)) {return;}

		if (!/\t/.test(line)) {
			if (line.includes('此字段可能返回 null')) {
				configs[configs.length - 1].required = false;
			}
			return;
		};
		
		const columns = parseLine(line);
		const rs: Record<string, any> = {};
		columns.forEach((v, i) => {
			rs[headers[i]] = v;
		});
		if (rs.required === undefined) {
			rs.required = true;
		}

		configs.push(rs);
	});

	// 组装
	let result = `type ${typeName} = {\n`;
	let extraRs = '';
	configs.forEach(config => {
		const { desc, field, required, type } = config;
		const [_type, extra] = genType(type);
		console.log(_type, extra);
		
		result += `${field}${required ? '' : '?'}: ${_type},//${desc ?? ''}\n`;
		extraRs += extra;
	});

	result += `}\n${extraRs}`;

	return result;
}


function str2Field(str: string): string {
	if (str.includes('名称')) {return 'field';}
	if (str.includes('必选')) {return 'required';}
	if (str.includes('类型')) {return 'type';}
	if (str.includes('描述')) {return 'desc';}
	return '';
}
function genHeaders(headLine: string): string[] {
	const columns = headLine.split('\t');

	if (isHeader(headLine)) {
		return columns.map(item => str2Field(item));
	}

	if (columns.length >= 4) {
		const [, a, b,] = columns;
		if (['是', '否'].includes(a.trim())) {
            return ['field', 'required', 'type', 'desc'];
        }
        if (['是', '否'].includes(b.trim())) {
            return ['field', 'type', 'required', 'desc'];
        }
	} else {
		return ['field', 'type', 'desc'];
	}

	return [];

}