#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('Loading FUSE3 module...');
const fuse = require('./build/Release/fuse3_napi.node');

console.log('Available exports:', Object.keys(fuse));

// Test mount point
const mountPoint = '/tmp/test-fuse-mount';

// Ensure mount point exists
if (!fs.existsSync(mountPoint)) {
    fs.mkdirSync(mountPoint, { recursive: true });
    console.log(`Created mount point: ${mountPoint}`);
}

// Define FUSE operations
const operations = {
    getattr: (path) => {
        console.log(`getattr: ${path}`);
        if (path === '/') {
            return {
                mode: 0o040755, // directory
                nlink: 2,
                uid: process.getuid(),
                gid: process.getgid(),
                size: 4096,
                atime: Date.now(),
                mtime: Date.now(),
                ctime: Date.now()
            };
        } else if (path === '/hello.txt') {
            const content = 'Hello from FUSE3!\n';
            return {
                mode: 0o100644, // regular file
                nlink: 1,
                uid: process.getuid(),
                gid: process.getgid(),
                size: content.length,
                atime: Date.now(),
                mtime: Date.now(),
                ctime: Date.now()
            };
        }
        return fuse.ENOENT;
    },
    
    readdir: (path) => {
        console.log(`readdir: ${path}`);
        if (path === '/') {
            return ['.', '..', 'hello.txt'];
        }
        return fuse.ENOENT;
    },
    
    open: (path, flags) => {
        console.log(`open: ${path}, flags: ${flags}`);
        if (path === '/hello.txt') {
            return 0; // success
        }
        return fuse.ENOENT;
    },
    
    read: (path, size, offset) => {
        console.log(`read: ${path}, size: ${size}, offset: ${offset}`);
        if (path === '/hello.txt') {
            const content = 'Hello from FUSE3!\n';
            return content.slice(offset, offset + size);
        }
        return fuse.ENOENT;
    }
};

// Create FUSE instance
console.log('Creating FUSE3 instance...');
try {
    const fuseInstance = new fuse.Fuse3(mountPoint, operations);
    console.log('FUSE3 instance created successfully');
    
    // Check if we can mount
    console.log('Checking mount capability...');
    if (fuseInstance.isMounted) {
        console.log('isMounted method available');
    }
    
} catch (error) {
    console.error('Failed to create FUSE3 instance:', error);
}

console.log('Test completed.');