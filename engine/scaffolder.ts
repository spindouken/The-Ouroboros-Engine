/**
 * The Scaffolder (Project Body Generator) - Pillar 3 of V2.99
 * 
 * Role: Transforms the "Project Soul" (Bible) into a physical "Body" (ZIP file)
 * Philosophy: "Spec-to-Code Bridge without becoming a Code Generator"
 * 
 * This module takes verified bricks and the Living Constitution and generates:
 * - A complete project structure with proper directories
 * - Stub files with JSDoc comments derived from specifications
 * - TypeScript interfaces derived from verified bricks
 * - package.json with dependencies from Constitution tech stack
 * - README.md auto-generated from Bible summary
 * - TODO comments linking back to Bible sections
 * 
 * IMPORTANT: The stubs contain NO implementation logic. They contain:
 * - Interfaces derived from the Specs
 * - JSDoc Comments documenting expected behavior
 * - Type signatures for all functions
 * - TODO comments linking back to Bible sections
 */

import { VerifiedBrick } from './blackboard-delta';
import { GlobalContext } from './blackboard-delta';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for scaffold generation
 */
export interface ScaffoldConfig {
    /** Project name (kebab-case) */
    projectName: string;

    /** Technology stack from Constitution */
    techStack: string[];

    /** Verified bricks (epics/specifications) */
    bricks: VerifiedBrick[];

    /** Living Constitution data */
    constitution: GlobalContext;

    /** Project domain (e.g., "SaaS", "API", "Mobile") */
    domain: string;
}

/**
 * Represents a file or directory in the scaffold tree
 */
export interface FileNode {
    /** Path relative to project root */
    path: string;

    /** Whether this is a file or directory */
    type: 'file' | 'directory';

    /** File content (only for files) */
    content?: string;

    /** Child nodes (only for directories) */
    children?: FileNode[];
}

/**
 * Result of scaffold generation
 */
export interface ScaffoldResult {
    /** The generated file tree */
    tree: FileNode;

    /** Total number of files generated */
    fileCount: number;

    /** Total number of directories created */
    directoryCount: number;

    /** Summary of what was generated */
    summary: string;

    /** Timestamp of generation */
    generatedAt: number;
}

/**
 * Template type for different file kinds
 */
export type TemplateType =
    | 'react-component'
    | 'service'
    | 'types'
    | 'util'
    | 'hook'
    | 'package-json'
    | 'tsconfig'
    | 'readme'
    | 'index'
    | 'api-route'
    | 'test';

// ============================================================================
// SCAFFOLDER CLASS
// ============================================================================

export class Scaffolder {
    private config?: ScaffoldConfig;

    /**
     * Generate the complete file tree from scaffold config
     */
    generateFileTree(config: ScaffoldConfig): FileNode {
        this.config = config;

        const projectName = this.toKebabCase(config.projectName || 'ouroboros-project');

        // Root directory
        const root: FileNode = {
            path: projectName,
            type: 'directory',
            children: []
        };

        // Generate core files
        root.children!.push(this.generatePackageJson(config));
        root.children!.push(this.generateTsConfig(config));
        root.children!.push(this.generateReadme(config));
        root.children!.push(this.generateGitIgnore());

        // Generate src directory with structure
        const srcDir = this.generateSrcDirectory(config);
        root.children!.push(srcDir);

        // Generate tests directory
        const testsDir = this.generateTestsDirectory(config);
        root.children!.push(testsDir);

        return root;
    }

    /**
     * Generate a ZIP blob from the file tree
     * Uses JSZip for client-side ZIP creation
     */
    async generateZip(tree: FileNode): Promise<Blob> {
        // Dynamically import JSZip (client-side only)
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // Recursively add files to ZIP
        this.addToZip(zip, tree, '');

        // Generate the blob
        return zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    }

    /**
     * Recursively add files/directories to a JSZip instance
     */
    private addToZip(zip: any, node: FileNode, parentPath: string): void {
        const currentPath = parentPath ? `${parentPath}/${node.path}` : node.path;

        if (node.type === 'directory') {
            // Create directory in zip
            const folder = zip.folder(currentPath);

            // Add children
            if (node.children) {
                for (const child of node.children) {
                    this.addToZip(zip, child, currentPath);
                }
            }
        } else {
            // Add file to zip
            zip.file(currentPath, node.content || '');
        }
    }

    /**
     * Generate a complete ScaffoldResult with metadata
     */
    generate(config: ScaffoldConfig): ScaffoldResult {
        const tree = this.generateFileTree(config);
        const stats = this.countNodes(tree);

        return {
            tree,
            fileCount: stats.files,
            directoryCount: stats.directories,
            summary: `Generated ${stats.files} files across ${stats.directories} directories for "${config.projectName}"`,
            generatedAt: Date.now()
        };
    }

    // ========================================================================
    // CORE FILE GENERATORS
    // ========================================================================

    /**
     * Generate package.json based on tech stack
     */
    private generatePackageJson(config: ScaffoldConfig): FileNode {
        const techStack = config.techStack.map(t => t.toLowerCase());

        const dependencies: Record<string, string> = {};
        const devDependencies: Record<string, string> = {
            'typescript': '^5.3.0',
            '@types/node': '^20.10.0'
        };

        // Add dependencies based on tech stack
        if (techStack.some(t => t.includes('react'))) {
            dependencies['react'] = '^18.2.0';
            dependencies['react-dom'] = '^18.2.0';
            devDependencies['@types/react'] = '^18.2.64';
            devDependencies['@types/react-dom'] = '^18.2.21';
        }

        if (techStack.some(t => t.includes('next'))) {
            dependencies['next'] = '^14.0.0';
        }

        if (techStack.some(t => t.includes('express'))) {
            dependencies['express'] = '^4.18.0';
            devDependencies['@types/express'] = '^4.17.21';
        }

        if (techStack.some(t => t.includes('node') || t.includes('nodejs'))) {
            // Base Node setup already covered
        }

        if (techStack.some(t => t.includes('tailwind'))) {
            devDependencies['tailwindcss'] = '^3.4.0';
            devDependencies['postcss'] = '^8.4.0';
            devDependencies['autoprefixer'] = '^10.4.0';
        }

        if (techStack.some(t => t.includes('prisma'))) {
            devDependencies['prisma'] = '^5.7.0';
            dependencies['@prisma/client'] = '^5.7.0';
        }

        if (techStack.some(t => t.includes('vite'))) {
            devDependencies['vite'] = '^5.0.0';
            devDependencies['@vitejs/plugin-react'] = '^4.2.0';
        }

        // Testing
        devDependencies['vitest'] = '^1.0.0';
        devDependencies['@testing-library/react'] = '^14.1.0';

        const packageJson = {
            name: this.toKebabCase(config.projectName),
            version: '0.1.0',
            private: true,
            description: `Generated by Ouroboros Engine V2.99 - ${config.domain}`,
            type: 'module',
            scripts: {
                'dev': techStack.some(t => t.includes('next'))
                    ? 'next dev'
                    : techStack.some(t => t.includes('vite'))
                        ? 'vite'
                        : 'tsx watch src/index.ts',
                'build': techStack.some(t => t.includes('next'))
                    ? 'next build'
                    : techStack.some(t => t.includes('vite'))
                        ? 'vite build'
                        : 'tsc',
                'start': techStack.some(t => t.includes('next'))
                    ? 'next start'
                    : 'node dist/index.js',
                'test': 'vitest',
                'lint': 'eslint . --ext .ts,.tsx',
                'typecheck': 'tsc --noEmit'
            },
            dependencies: Object.keys(dependencies).length > 0 ? dependencies : undefined,
            devDependencies,
            engines: {
                node: '>=18.0.0'
            },
            keywords: ['ouroboros', 'generated', config.domain.toLowerCase()],
            author: 'Ouroboros Engine V2.99'
        };

        return {
            path: 'package.json',
            type: 'file',
            content: JSON.stringify(packageJson, null, 2)
        };
    }

    /**
     * Generate tsconfig.json
     */
    private generateTsConfig(config: ScaffoldConfig): FileNode {
        const techStack = config.techStack.map(t => t.toLowerCase());
        const isReact = techStack.some(t => t.includes('react'));
        const isNext = techStack.some(t => t.includes('next'));

        const tsconfig = {
            compilerOptions: {
                target: 'ES2022',
                lib: isReact ? ['dom', 'dom.iterable', 'ES2022'] : ['ES2022'],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: isNext,
                esModuleInterop: true,
                module: 'ESNext',
                moduleResolution: 'bundler',
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: isReact ? 'react-jsx' : undefined,
                incremental: true,
                baseUrl: '.',
                paths: {
                    '@/*': ['./src/*']
                },
                outDir: isNext ? undefined : './dist'
            },
            include: isNext
                ? ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts']
                : ['src/**/*', 'tests/**/*'],
            exclude: ['node_modules', 'dist']
        };

        return {
            path: 'tsconfig.json',
            type: 'file',
            content: JSON.stringify(tsconfig, null, 2)
        };
    }

    /**
     * Generate README.md from Bible summary
     */
    private generateReadme(config: ScaffoldConfig): FileNode {
        const lines: string[] = [];

        lines.push(`# ${this.toTitleCase(config.projectName)}`);
        lines.push('');
        lines.push(`> Generated by **Ouroboros Engine V2.99** - The Pragmatic Brick Factory`);
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## 📋 Project Overview');
        lines.push('');
        lines.push(`**Domain:** ${config.domain}`);
        lines.push('');
        lines.push('### Tech Stack');
        lines.push('');
        config.techStack.forEach(tech => {
            lines.push(`- ${tech}`);
        });
        lines.push('');
        lines.push('### Constraints');
        lines.push('');
        if (config.constitution.constraints.length > 0) {
            config.constitution.constraints.forEach(c => {
                lines.push(`- ⚠️ ${c}`);
            });
        } else {
            lines.push('- No specific constraints defined');
        }
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## 🚀 Getting Started');
        lines.push('');
        lines.push('```bash');
        lines.push('# Install dependencies');
        lines.push('npm install');
        lines.push('');
        lines.push('# Run development server');
        lines.push('npm run dev');
        lines.push('');
        lines.push('# Run tests');
        lines.push('npm test');
        lines.push('');
        lines.push('# Build for production');
        lines.push('npm run build');
        lines.push('```');
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## 📁 Project Structure');
        lines.push('');
        lines.push('```');
        lines.push(`${this.toKebabCase(config.projectName)}/`);
        lines.push('├── src/');
        lines.push('│   ├── components/     # React components (if applicable)');
        lines.push('│   ├── services/       # Business logic and API services');
        lines.push('│   ├── types/          # TypeScript interfaces and types');
        lines.push('│   ├── utils/          # Utility functions');
        lines.push('│   └── index.ts        # Entry point');
        lines.push('├── tests/              # Test files');
        lines.push('├── package.json');
        lines.push('├── tsconfig.json');
        lines.push('└── README.md');
        lines.push('```');
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## 📖 Modules (From Verified Specifications)');
        lines.push('');

        // Add section for each brick/epic
        config.bricks.forEach((brick, i) => {
            lines.push(`### ${i + 1}. ${brick.instruction}`);
            lines.push('');
            lines.push(`*Specialist: ${brick.persona}*`);
            lines.push('');
            // Add first 500 chars of artifact as summary
            const summary = brick.artifact.substring(0, 500).replace(/\n/g, ' ').trim();
            lines.push(`> ${summary}${brick.artifact.length > 500 ? '...' : ''}`);
            lines.push('');
            lines.push(`📄 See \`PROJECT_BIBLE.md\` section ${i + 1} for full specification.`);
            lines.push('');
        });

        lines.push('---');
        lines.push('');
        lines.push('## 📝 Development Notes');
        lines.push('');
        lines.push('This project was scaffolded from an AI-generated specification.');
        lines.push('Each module contains **stub implementations** with:');
        lines.push('');
        lines.push('- ✅ TypeScript interfaces derived from specifications');
        lines.push('- ✅ JSDoc comments documenting expected behavior');
        lines.push('- ✅ Type signatures for all functions');
        lines.push('- ✅ `TODO` comments linking back to Bible sections');
        lines.push('');
        lines.push('**Your task:** Fill in the implementations following the detailed specifications in `PROJECT_BIBLE.md`.');
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push(`*Scaffold generated at ${new Date().toISOString()}*`);

        return {
            path: 'README.md',
            type: 'file',
            content: lines.join('\n')
        };
    }

    /**
     * Generate .gitignore
     */
    private generateGitIgnore(): FileNode {
        const content = `# Dependencies
node_modules/

# Build output
dist/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Misc
*.tsbuildinfo
.turbo/
`;

        return {
            path: '.gitignore',
            type: 'file',
            content
        };
    }

    // ========================================================================
    // DIRECTORY GENERATORS
    // ========================================================================

    /**
     * Generate the src directory with all subdirectories and files
     */
    private generateSrcDirectory(config: ScaffoldConfig): FileNode {
        const techStack = config.techStack.map(t => t.toLowerCase());
        const isReact = techStack.some(t => t.includes('react'));

        const srcDir: FileNode = {
            path: 'src',
            type: 'directory',
            children: []
        };

        // Generate types directory with interfaces from bricks
        srcDir.children!.push(this.generateTypesDirectory(config));

        // Generate services directory
        srcDir.children!.push(this.generateServicesDirectory(config));

        // Generate utils directory
        srcDir.children!.push(this.generateUtilsDirectory(config));

        // Generate components directory (if React)
        if (isReact) {
            srcDir.children!.push(this.generateComponentsDirectory(config));
        }

        // Generate entry point
        srcDir.children!.push(this.generateIndexFile(config));

        return srcDir;
    }

    /**
     * Generate types directory with TypeScript interfaces
     */
    private generateTypesDirectory(config: ScaffoldConfig): FileNode {
        const typesDir: FileNode = {
            path: 'types',
            type: 'directory',
            children: []
        };

        // Generate index.ts with all types
        const typeLines: string[] = [];
        typeLines.push('/**');
        typeLines.push(` * Auto-generated TypeScript types for ${config.projectName}`);
        typeLines.push(' * Generated by Ouroboros Engine V2.99');
        typeLines.push(' * ');
        typeLines.push(' * These interfaces are derived from the verified specifications.');
        typeLines.push(' * Refer to PROJECT_BIBLE.md for full context and rationale.');
        typeLines.push(' */');
        typeLines.push('');
        typeLines.push('// ============================================================================');
        typeLines.push('// CORE DOMAIN TYPES');
        typeLines.push('// ============================================================================');
        typeLines.push('');

        // Extract potential type names from bricks
        config.bricks.forEach((brick, i) => {
            const typeName = this.extractTypeName(brick.instruction);
            typeLines.push(`/**`);
            typeLines.push(` * ${brick.instruction}`);
            typeLines.push(` * @see PROJECT_BIBLE.md Section ${i + 1}`);
            typeLines.push(` * @specialist ${brick.persona}`);
            typeLines.push(` */`);
            typeLines.push(`export interface ${typeName} {`);
            typeLines.push(`    // TODO: Define properties based on PROJECT_BIBLE.md Section ${i + 1}`);
            typeLines.push(`    id: string;`);
            typeLines.push(`    createdAt: Date;`);
            typeLines.push(`    updatedAt: Date;`);
            typeLines.push(`}`);
            typeLines.push('');
        });

        // Add common utility types
        typeLines.push('// ============================================================================');
        typeLines.push('// UTILITY TYPES');
        typeLines.push('// ============================================================================');
        typeLines.push('');
        typeLines.push('/** API Response wrapper */');
        typeLines.push('export interface ApiResponse<T> {');
        typeLines.push('    success: boolean;');
        typeLines.push('    data?: T;');
        typeLines.push('    error?: string;');
        typeLines.push('    timestamp: number;');
        typeLines.push('}');
        typeLines.push('');
        typeLines.push('/** Pagination parameters */');
        typeLines.push('export interface PaginationParams {');
        typeLines.push('    page: number;');
        typeLines.push('    limit: number;');
        typeLines.push('    offset?: number;');
        typeLines.push('}');
        typeLines.push('');
        typeLines.push('/** Paginated response */');
        typeLines.push('export interface PaginatedResponse<T> extends ApiResponse<T[]> {');
        typeLines.push('    pagination: {');
        typeLines.push('        total: number;');
        typeLines.push('        page: number;');
        typeLines.push('        limit: number;');
        typeLines.push('        totalPages: number;');
        typeLines.push('    };');
        typeLines.push('}');

        typesDir.children!.push({
            path: 'index.ts',
            type: 'file',
            content: typeLines.join('\n')
        });

        return typesDir;
    }

    /**
     * Generate services directory with service stubs
     */
    private generateServicesDirectory(config: ScaffoldConfig): FileNode {
        const servicesDir: FileNode = {
            path: 'services',
            type: 'directory',
            children: []
        };

        // Generate a service for each major brick
        config.bricks.forEach((brick, i) => {
            const serviceName = this.extractServiceName(brick.instruction);
            const fileName = `${this.toKebabCase(serviceName)}.service.ts`;

            const serviceContent = this.generateServiceStub(brick, i, serviceName);

            servicesDir.children!.push({
                path: fileName,
                type: 'file',
                content: serviceContent
            });
        });

        // Generate services index
        const indexContent = this.generateServicesIndex(config.bricks);
        servicesDir.children!.push({
            path: 'index.ts',
            type: 'file',
            content: indexContent
        });

        return servicesDir;
    }

    /**
     * Generate a service stub file
     */
    private generateServiceStub(brick: VerifiedBrick, index: number, serviceName: string): string {
        const lines: string[] = [];
        const className = `${this.toPascalCase(serviceName)}Service`;
        const typeName = this.extractTypeName(brick.instruction);

        lines.push('/**');
        lines.push(` * ${serviceName} Service`);
        lines.push(` * `);
        lines.push(` * Handles: ${brick.instruction}`);
        lines.push(` * `);
        lines.push(` * @specialist ${brick.persona}`);
        lines.push(` * @see PROJECT_BIBLE.md Section ${index + 1}`);
        lines.push(` * `);
        lines.push(` * ## Specification Summary`);
        // Add first 300 chars of artifact
        const summary = brick.artifact.substring(0, 300).split('\n').map(l => ` * ${l}`).join('\n');
        lines.push(summary);
        if (brick.artifact.length > 300) {
            lines.push(` * ...`);
            lines.push(` * (See full specification in PROJECT_BIBLE.md)`);
        }
        lines.push(' */');
        lines.push('');
        lines.push(`import { ${typeName}, ApiResponse } from '../types';`);
        lines.push('');
        lines.push(`export class ${className} {`);
        lines.push('    /**');
        lines.push(`     * Create a new ${typeName}`);
        lines.push(`     * @param data - The ${typeName} data to create`);
        lines.push(`     * @returns Promise resolving to the created ${typeName}`);
        lines.push(`     * @todo Implement based on PROJECT_BIBLE.md Section ${index + 1}`);
        lines.push('     */');
        lines.push(`    async create(data: Partial<${typeName}>): Promise<ApiResponse<${typeName}>> {`);
        lines.push(`        // TODO: Implement create logic`);
        lines.push(`        // See PROJECT_BIBLE.md Section ${index + 1} for requirements`);
        lines.push('        throw new Error(\'Not implemented\');');
        lines.push('    }');
        lines.push('');
        lines.push('    /**');
        lines.push(`     * Get a ${typeName} by ID`);
        lines.push(`     * @param id - The ${typeName} ID`);
        lines.push(`     * @returns Promise resolving to the ${typeName}`);
        lines.push(`     * @todo Implement based on PROJECT_BIBLE.md Section ${index + 1}`);
        lines.push('     */');
        lines.push(`    async getById(id: string): Promise<ApiResponse<${typeName}>> {`);
        lines.push(`        // TODO: Implement getById logic`);
        lines.push(`        // See PROJECT_BIBLE.md Section ${index + 1} for requirements`);
        lines.push('        throw new Error(\'Not implemented\');');
        lines.push('    }');
        lines.push('');
        lines.push('    /**');
        lines.push(`     * Update a ${typeName}`);
        lines.push(`     * @param id - The ${typeName} ID`);
        lines.push(`     * @param data - The update data`);
        lines.push(`     * @returns Promise resolving to the updated ${typeName}`);
        lines.push(`     * @todo Implement based on PROJECT_BIBLE.md Section ${index + 1}`);
        lines.push('     */');
        lines.push(`    async update(id: string, data: Partial<${typeName}>): Promise<ApiResponse<${typeName}>> {`);
        lines.push(`        // TODO: Implement update logic`);
        lines.push(`        // See PROJECT_BIBLE.md Section ${index + 1} for requirements`);
        lines.push('        throw new Error(\'Not implemented\');');
        lines.push('    }');
        lines.push('');
        lines.push('    /**');
        lines.push(`     * Delete a ${typeName}`);
        lines.push(`     * @param id - The ${typeName} ID`);
        lines.push(`     * @returns Promise resolving to success status`);
        lines.push(`     * @todo Implement based on PROJECT_BIBLE.md Section ${index + 1}`);
        lines.push('     */');
        lines.push(`    async delete(id: string): Promise<ApiResponse<void>> {`);
        lines.push(`        // TODO: Implement delete logic`);
        lines.push(`        // See PROJECT_BIBLE.md Section ${index + 1} for requirements`);
        lines.push('        throw new Error(\'Not implemented\');');
        lines.push('    }');
        lines.push('');
        lines.push('    /**');
        lines.push(`     * List all ${typeName}s with pagination`);
        lines.push(`     * @param page - Page number`);
        lines.push(`     * @param limit - Items per page`);
        lines.push(`     * @returns Promise resolving to paginated ${typeName}s`);
        lines.push(`     * @todo Implement based on PROJECT_BIBLE.md Section ${index + 1}`);
        lines.push('     */');
        lines.push(`    async list(page = 1, limit = 10): Promise<ApiResponse<${typeName}[]>> {`);
        lines.push(`        // TODO: Implement list logic`);
        lines.push(`        // See PROJECT_BIBLE.md Section ${index + 1} for requirements`);
        lines.push('        throw new Error(\'Not implemented\');');
        lines.push('    }');
        lines.push('}');
        lines.push('');
        lines.push(`// Export singleton instance`);
        lines.push(`export const ${this.toCamelCase(serviceName)}Service = new ${className}();`);

        return lines.join('\n');
    }

    /**
     * Generate services index file
     */
    private generateServicesIndex(bricks: VerifiedBrick[]): string {
        const lines: string[] = [];
        lines.push('/**');
        lines.push(' * Services Index');
        lines.push(' * Auto-generated by Ouroboros Engine V2.99');
        lines.push(' */');
        lines.push('');

        bricks.forEach((brick) => {
            const serviceName = this.extractServiceName(brick.instruction);
            const fileName = this.toKebabCase(serviceName);
            lines.push(`export * from './${fileName}.service';`);
        });

        return lines.join('\n');
    }

    /**
     * Generate utils directory
     */
    private generateUtilsDirectory(config: ScaffoldConfig): FileNode {
        const utilsDir: FileNode = {
            path: 'utils',
            type: 'directory',
            children: []
        };

        // Generate common utility files
        utilsDir.children!.push({
            path: 'helpers.ts',
            type: 'file',
            content: `/**
 * Helper utilities
 * Auto-generated by Ouroboros Engine V2.99
 */

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return crypto.randomUUID();
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString();
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json);
    } catch {
        return fallback;
    }
}
`
        });

        utilsDir.children!.push({
            path: 'index.ts',
            type: 'file',
            content: `export * from './helpers';
`
        });

        return utilsDir;
    }

    /**
     * Generate components directory (React projects)
     */
    private generateComponentsDirectory(config: ScaffoldConfig): FileNode {
        const componentsDir: FileNode = {
            path: 'components',
            type: 'directory',
            children: []
        };

        // Generate a component stub for each brick
        config.bricks.forEach((brick, i) => {
            const componentName = this.extractComponentName(brick.instruction);
            const folderName = componentName;

            // Create component folder
            const componentFolder: FileNode = {
                path: folderName,
                type: 'directory',
                children: []
            };

            // Main component file
            componentFolder.children!.push({
                path: `${componentName}.tsx`,
                type: 'file',
                content: this.generateReactComponentStub(brick, i, componentName)
            });

            // Component index
            componentFolder.children!.push({
                path: 'index.ts',
                type: 'file',
                content: `export { ${componentName} } from './${componentName}';\n`
            });

            componentsDir.children!.push(componentFolder);
        });

        // Components index
        const indexLines: string[] = ['// Component exports', ''];
        config.bricks.forEach((brick) => {
            const componentName = this.extractComponentName(brick.instruction);
            indexLines.push(`export * from './${componentName}';`);
        });

        componentsDir.children!.push({
            path: 'index.ts',
            type: 'file',
            content: indexLines.join('\n')
        });

        return componentsDir;
    }

    /**
     * Generate a React component stub
     */
    private generateReactComponentStub(brick: VerifiedBrick, index: number, componentName: string): string {
        const typeName = this.extractTypeName(brick.instruction);

        return `/**
 * ${componentName} Component
 * 
 * Purpose: ${brick.instruction}
 * 
 * @specialist ${brick.persona}
 * @see PROJECT_BIBLE.md Section ${index + 1}
 */

import React from 'react';

/**
 * Props for ${componentName}
 */
interface ${componentName}Props {
    /** Optional class name for styling */
    className?: string;
    // TODO: Add props based on PROJECT_BIBLE.md Section ${index + 1}
}

/**
 * ${componentName}
 * 
 * ${brick.instruction}
 * 
 * @todo Implement UI based on PROJECT_BIBLE.md Section ${index + 1}
 */
export const ${componentName}: React.FC<${componentName}Props> = ({ className }) => {
    // TODO: Implement component logic
    // See PROJECT_BIBLE.md Section ${index + 1} for requirements
    
    return (
        <div className={className}>
            {/* TODO: Implement ${componentName} UI */}
            <p>${componentName} - Not implemented</p>
            <p>See PROJECT_BIBLE.md Section ${index + 1}</p>
        </div>
    );
};

export default ${componentName};
`;
    }

    /**
     * Generate main entry point file
     */
    private generateIndexFile(config: ScaffoldConfig): FileNode {
        const techStack = config.techStack.map(t => t.toLowerCase());
        const isReact = techStack.some(t => t.includes('react'));

        let content: string;

        if (isReact) {
            content = `/**
 * ${config.projectName} - Entry Point
 * Generated by Ouroboros Engine V2.99
 * 
 * Domain: ${config.domain}
 * Tech Stack: ${config.techStack.join(', ')}
 */

// Export all services
export * from './services';

// Export all types
export * from './types';

// Export all components
export * from './components';

// Export all utilities
export * from './utils';

console.log('🐍 ${config.projectName} initialized - Ouroboros V2.99');
`;
        } else {
            content = `/**
 * ${config.projectName} - Entry Point
 * Generated by Ouroboros Engine V2.99
 * 
 * Domain: ${config.domain}
 * Tech Stack: ${config.techStack.join(', ')}
 */

// Export all services
export * from './services';

// Export all types
export * from './types';

// Export all utilities
export * from './utils';

/**
 * Main application entry point
 * @todo Implement based on PROJECT_BIBLE.md
 */
async function main(): Promise<void> {
    console.log('🐍 ${config.projectName} starting - Ouroboros V2.99');
    
    // TODO: Initialize application based on PROJECT_BIBLE.md
    // See individual module specifications for implementation details
    
    console.log('✅ Application initialized');
}

// Run if executed directly
main().catch(console.error);
`;
        }

        return {
            path: 'index.ts',
            type: 'file',
            content
        };
    }

    /**
     * Generate tests directory
     */
    private generateTestsDirectory(config: ScaffoldConfig): FileNode {
        const testsDir: FileNode = {
            path: 'tests',
            type: 'directory',
            children: []
        };

        // Generate test files for each brick
        config.bricks.forEach((brick, i) => {
            const serviceName = this.extractServiceName(brick.instruction);
            const testFileName = `${this.toKebabCase(serviceName)}.test.ts`;

            testsDir.children!.push({
                path: testFileName,
                type: 'file',
                content: this.generateTestStub(brick, i, serviceName)
            });
        });

        // Test setup file
        testsDir.children!.push({
            path: 'setup.ts',
            type: 'file',
            content: `/**
 * Test Setup
 * Auto-generated by Ouroboros Engine V2.99
 */

// Add any global test setup here
console.log('🧪 Test environment initialized');
`
        });

        return testsDir;
    }

    /**
     * Generate a test stub file
     */
    private generateTestStub(brick: VerifiedBrick, index: number, serviceName: string): string {
        const className = `${this.toPascalCase(serviceName)}Service`;

        return `/**
 * Tests for ${serviceName}
 * 
 * Covers: ${brick.instruction}
 * @see PROJECT_BIBLE.md Section ${index + 1}
 */

import { describe, it, expect, beforeEach } from 'vitest';
// import { ${className} } from '../src/services';

describe('${className}', () => {
    // let service: ${className};

    beforeEach(() => {
        // service = new ${className}();
    });

    describe('create', () => {
        it.todo('should create a new entity');
        it.todo('should validate required fields');
        it.todo('should return created entity with ID');
    });

    describe('getById', () => {
        it.todo('should retrieve entity by ID');
        it.todo('should return null for non-existent ID');
    });

    describe('update', () => {
        it.todo('should update existing entity');
        it.todo('should return error for non-existent ID');
    });

    describe('delete', () => {
        it.todo('should delete existing entity');
        it.todo('should return error for non-existent ID');
    });

    describe('list', () => {
        it.todo('should return paginated results');
        it.todo('should handle empty results');
    });

    // TODO: Add specific tests based on PROJECT_BIBLE.md Section ${index + 1}
    // The specification requires the following test coverage:
    // - [Add specific test requirements from specification]
});
`;
    }

    // ========================================================================
    // UTILITY METHODS
    // ========================================================================

    /**
     * Convert string to kebab-case
     */
    private toKebabCase(str: string): string {
        return str
            .replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .replace(/[^\w-]/g, '')
            .toLowerCase();
    }

    /**
     * Convert string to PascalCase
     */
    private toPascalCase(str: string): string {
        return str
            .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
            .replace(/^(.)/, (c) => c.toUpperCase());
    }

    /**
     * Convert string to camelCase
     */
    private toCamelCase(str: string): string {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    /**
     * Convert string to Title Case
     */
    private toTitleCase(str: string): string {
        return str
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
    }

    /**
     * Extract a type name from an instruction string
     */
    private extractTypeName(instruction: string): string {
        // Remove common prefixes and extract key noun
        const cleaned = instruction
            .replace(/^(design|implement|create|build|develop|define|specify)\s*/i, '')
            .replace(/\s*(system|module|component|service|handler|manager|controller|feature)$/i, '')
            .trim();

        // Take first 2-3 significant words
        const words = cleaned.split(/\s+/).slice(0, 3);
        return this.toPascalCase(words.join(' ')) || 'Entity';
    }

    /**
     * Extract a service name from an instruction string
     */
    private extractServiceName(instruction: string): string {
        return this.extractTypeName(instruction);
    }

    /**
     * Extract a component name from an instruction string
     */
    private extractComponentName(instruction: string): string {
        const base = this.extractTypeName(instruction);
        return base.endsWith('View') || base.endsWith('Component')
            ? base
            : `${base}View`;
    }

    /**
     * Count files and directories in a tree
     */
    private countNodes(node: FileNode): { files: number; directories: number } {
        let files = 0;
        let directories = 0;

        if (node.type === 'directory') {
            directories++;
            if (node.children) {
                for (const child of node.children) {
                    const childStats = this.countNodes(child);
                    files += childStats.files;
                    directories += childStats.directories;
                }
            }
        } else {
            files++;
        }

        return { files, directories };
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const scaffolder = new Scaffolder();
