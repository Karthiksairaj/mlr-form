import 'dotenv/config';
import { chromium } from 'playwright';
import readline from 'node:readline';
import { mkdir, writeFile } from 'node:fs/promises';
import { extractVisibleFields } from '../dist/form/field-extractor.js';
import { fillFields } from '../dist/form/executor.js';
import { conformGeneratedValues, validateGeneratedValues } from '../dist/form/field-validation.js';
import { DeterministicDataGenerator } from '../dist/form/deterministic-data-generator.js';
import { GeminiDataGenerator } from '../dist/gemini/data-generator.js';
import { config } from '../dist/config.js';
const browser = await chromium.launch({headless:true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page = await browser.newPage({viewport:{width:1440,height:1100}});
page.setDefaultTimeout(10000);
await mkdir('work/rinvoq-live-debug',{recursive:true});
const generator = config.dataGeneratorProvider === 'gemini' ? new GeminiDataGenerator(config.aiApiKey,config.aiModel) : new DeterministicDataGenerator();
const state = {};
const scan = async () => {
  const fields = await extractVisibleFields(page);
  state.fields = fields;
  return fields.map(f => ({id:f.id,name:f.name,label:f.label,question:f.question,type:f.type,readOnly:f.readOnly,pattern:f.pattern,options:f.options,frameUrl:f.frameUrl}));
};
const snap = async name => {await page.screenshot({path:`work/rinvoq-live-debug/${name}.png`,fullPage:true,timeout:10000});};
const rl = readline.createInterface({input:process.stdin,terminal:false});
rl.on('line',async line => {
  try {
    if(line==='exit') {await browser.close();process.exit(0);}
    const result = await new Function('page','state','scan','snap','generator','fillFields','conformGeneratedValues','validateGeneratedValues','writeFile',`return (async()=>{${line}})()`)(page,state,scan,snap,generator,fillFields,conformGeneratedValues,validateGeneratedValues,writeFile);
    console.log('RESULT',JSON.stringify(result));
  } catch(error) {console.log('ERROR',error.message);}
});
await page.goto('https://rinvoq99.p.cwcm-admp.com/sign-up1',{waitUntil:'domcontentloaded',timeout:45000}).catch(e=>console.log('NAVIGATION',e.message));
console.log('READY',page.url());
