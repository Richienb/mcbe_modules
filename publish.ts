
import fs = require('fs');
import cp = require('child_process');
import path = require('path');

const cwd = process.cwd();
const gitignore = fs.readFileSync('.gitignore', 'utf-8');
const publish_result = JSON.parse(fs.readFileSync('publish_result.json', 'utf-8'));

let lines = gitignore.split(/\r?\n/g);

const start = lines.indexOf('##<packages>')+1;
const end = lines.indexOf('##</packages>', start);

const mainpackage = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
let mainpackageModified = false;

let latestCount = 0;
let publishCount = 0;
let errorCount = 0;

const CHECK_WAIT = -1;
const CHECK_PASSED = -2;

const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf-8'));
let tsconfigModified = false;
const tsconfigInclude = new Set(tsconfig.include);

class Package
{
    public readonly result:{
        version?:string
    };
    public readonly path:string;
    public readonly json:{
        version:string;
        name:string
        dependencies:{[key:string]:string};
    };
    public readonly isLatest:boolean;
    public check:number;

    constructor(line:string, public readonly name:string)
    {
        if (!(this.name in mainpackage.dependencies))
        {
            mainpackage.dependencies[this.name] = 'latest';
            mainpackageModified = true;
            console.log(`${this.name}: added dependency to main package.json`);
        }
        this.result = publish_result[name]
        if (!this.result) publish_result[name] = this.result = {};
    
        this.path = line.substr(1);
        if (!fs.existsSync(cwd + this.path+'/.npmignore')) console.error(`no .npmignore`);

        
        const include = this.path.substr(1)+'/**/*';
        if (!tsconfigInclude.has(include))
        {
            tsconfigInclude.add(include);
            tsconfigModified = true;
            console.log(`${this.name}: added include to tsconfig.json`);
        }
        
        let packagetext;
        try
        {
            packagetext = fs.readFileSync(cwd + this.path+'/package.json', 'utf-8');
        }
        catch (err)
        {
            throw Error(`cannot open package.json, ${err.code}`);
        }
        
        try
        {
            this.json = JSON.parse(packagetext);
            if (this.json.name !== this.name)
            {
                throw Error(`wrong package name`);
            }
        }
        catch (err)
        {
            throw Error(`invalid package.json`);
        }

        this.isLatest = this.result.version === this.json.version;

        this.check = CHECK_WAIT;
    }

}

///////////////////////////////////////////////
// load packages
const packages = new Map<string, Package>();
for (const line of lines.slice(start, end))
{
    if (!line.startsWith('!/node_modules/'))
    {
        console.error(`invalid path ${line}`);
        errorCount++;
        continue;
    }

    const name = line.substr(15);
    try
    {
        packages.set(name, new Package(line, name));
    }
    catch (err)
    {
        console.error(err.message);
        errorCount++;
    }
}

///////////////////////////////////////////////
// check deps
const stacks:Package[] = [];

function checkDependency(pkg:Package):void
{
    if (pkg.check === CHECK_PASSED) return;
    if (pkg.check !== CHECK_WAIT) 
    {
        console.error('Dependency check failed: '+stacks.slice(pkg.check).join('->'));
        process.exit(-1);
    }
    pkg.check = stacks.length;
    stacks.push(pkg);
    for (const dep in pkg.json.dependencies)
    {
        const pkg = packages.get(dep);
        if (!pkg) continue;
        checkDependency(pkg);
    }
    stacks.pop();
    pkg.check = CHECK_PASSED;
}

for (const pkg of packages.values())
{
    checkDependency(pkg);
}

///////////////////////////////////////////////
// update modified
if (mainpackageModified)
{
    fs.writeFileSync('package.json', JSON.stringify(mainpackage, null, 4), 'utf-8');
}

if (tsconfigModified)
{
    tsconfig.include = [...tsconfigInclude.values()];
    fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 4), 'utf-8');
    process.exit(0);
}

///////////////////////////////////////////////
// publish
for (const pkg of packages.values())
{
    if (pkg.isLatest)
    {
        latestCount++;
        continue;
    }

    console.log(`${pkg.name}@${pkg.json.version}: publishing...`);
    process.chdir(cwd + pkg.path);

    try
    {
        let cmd = 'npm publish';
        if (pkg.name.startsWith('@'))
        {
            cmd += ' --access public';
        }
        cp.execSync(cmd);
        pkg.result.version = pkg.json.version;
        publishCount++;
    }
    catch (err)
    {
        const message = err.message;
        if (message.indexOf('You cannot publish over the previously published versions') !== -1)
        {
            console.log(`${pkg.name}: latest`);
            pkg.result.version = pkg.json.version;
            latestCount++;
        }
        else
        {
            console.error(message);
            errorCount++;
        }
    }
}

process.chdir(cwd);
fs.writeFileSync('publish_result.json', JSON.stringify(publish_result, null, 4), 'utf-8');

console.log('published: '+publishCount);
console.log('latest: '+latestCount);
if (errorCount !== 0)
{
    console.error('error: '+errorCount);
}
else
{
    console.log('error: '+errorCount);
}

// cp.execSync('npm publish');
