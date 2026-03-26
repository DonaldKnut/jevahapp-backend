const fs = require('fs');
const path = require('path');

const files = [
    'audit.service.ts',
    'contentInteraction.service.ts',
    'media.service.ts',
    'playbackSession.service.ts',
    'recommendationEngine.service.ts',
    'socket.service.ts',
    'unifiedBookmark.service.ts',
    'unifiedSearch.service.ts',
];

const dir = 'c:\\Users\\Lenovo\\OneDrive\\Desktop\\jevahapp-backend\\src\\service';

for (const f of files) {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) continue;
    let code = fs.readFileSync(p, 'utf8');

    // 1. replace imports
    code = code.replace(/import\s*\{\s*MediaInteraction(\s*,\s*IMediaInteraction)?\s*\}\s*from\s*['"]\.\.\/models\/mediaInteraction\.model['"];?/g, 'import { Interaction, IInteraction } from "../models/interaction.model";');

    // 2. replace remaining usages
    code = code.replace(/\bMediaInteraction\b/g, 'Interaction');
    code = code.replace(/\bIMediaInteraction\b/g, 'IInteraction');

    fs.writeFileSync(p, code);
    console.log('Fixed ' + f);
}
