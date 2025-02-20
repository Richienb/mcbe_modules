import { readIdFromVanilaPack } from "./read_id";
import { readIdAndRecipeFromVanilaPack } from "./read_recipe";

import fs = require('fs');
import { recipes_data } from "./extra_recipe";
import Identifier from "@mcbe/identifier";

export function generateId():void
{
    let out:fs.WriteStream;

    readIdFromVanilaPack();
    readIdAndRecipeFromVanilaPack();
    
    // recipe
    out = fs.createWriteStream('node_modules/@mcbe/recipe/list.ts', 'utf-8');
    out.write(`
import { Recipe } from ".";
import ID from "@mcbe/identifier/id";

export const recipes = new Map([`);
    for (const [id, recipe] of recipes_data)
    {
        if (!id) continue;
        out.write('\n    [ID.');
        out.write(id.mini);
        out.write(',[\n        ');
        recipe.sort((a,b)=>a.complexCompare(b));
        out.write(recipe.map(r=>r.toSource()).join(',\n        '));
        out.write('\n    ]],');
    }
    out.write('\n]);\n');
    out.end();

    // ID
    out = fs.createWriteStream('node_modules/@mcbe/identifier/id.ts', 'utf-8');
    out.write(`
import MAKEID from "./make";

const ID = {
`);
    
    for (const id of Identifier.all())
    {
        out.write('    ');
        out.write(id.mini);
        out.write(': MAKEID.');
        out.write(id.mini);
        out.write(',\n');
    }
    out.write(`};
export default ID;
`);
    out.end();
}
