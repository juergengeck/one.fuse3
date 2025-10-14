# FUSE3 N-API Addon for OneFiler

This directory contains the N-API (Node-API) implementation for FUSE3 bindings, providing high-performance, ABI-stable access to Linux FUSE3 functionality.

## Architecture

The addon consists of:
- **fuse3_napi.cc** - Main N-API addon class and lifecycle management
- **fuse3_operations.cc** - FUSE operation implementations that bridge to JavaScript
- **index.js** - JavaScript wrapper providing a clean API
- **binding.gyp** - Build configuration for node-gyp

## Prerequisites

### System Requirements
- Linux or WSL2 (Windows Subsystem for Linux 2)
- Node.js 14.0.0 or higher
- FUSE3 development libraries

### Install FUSE3 (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install libfuse3-dev fuse3
```

### Install Node.js build tools
```bash
npm install -g node-gyp
# or
sudo apt install build-essential
```

## Building

From this directory:

```bash
# Install dependencies
npm install

# Configure build
npm run configure

# Build the addon
npm run build

# Or rebuild everything
npm run rebuild
```

The compiled addon will be at: `build/Release/fuse3_napi.node`

## Usage

### From JavaScript
```javascript
const { Fuse } = require('./index.js');

// Define filesystem operations
const operations = {
    getattr: (path, cb) => {
        if (path === '/') {
            cb(0, {
                mode: 0o40755,  // directory
                size: 4096,
                mtime: new Date(),
                atime: new Date(),
                ctime: new Date()
            });
        } else {
            cb(Fuse.ENOENT);
        }
    },
    
    readdir: (path, cb) => {
        if (path === '/') {
            cb(0, ['file.txt']);
        } else {
            cb(Fuse.ENOENT);
        }
    }
};

// Create and mount
const fuse = new Fuse('/mnt/myfs', operations);
fuse.mount((err) => {
    if (err) {
        console.error('Mount failed:', err);
        return;
    }
    console.log('Mounted successfully');
});
```

### From TypeScript (via native-fuse3.ts)
The addon is automatically loaded by the `native-fuse3.ts` module when available.

## Testing

Run the test to verify the addon works:

```bash
# With compiled addon
npm run build
node test.js

# In another terminal, test the filesystem
ls -la /tmp/fuse3-napi-test
cat /tmp/fuse3-napi-test/hello.txt
```

## Development Notes

### Thread Safety
- The addon uses ThreadSafeFunction for all callbacks to JavaScript
- FUSE operations run in a separate thread
- All JavaScript callbacks are properly marshaled to the main thread

### Error Handling
- FUSE expects negative errno values (e.g., -ENOENT = -2)
- JavaScript errors are automatically converted to -EIO
- The wrapper handles error code conversion

### Performance
- N-API provides zero-copy buffer operations where possible
- The addon is ABI-stable across Node.js versions
- Single-threaded FUSE mode is used for simplicity (can be made multi-threaded)

## Troubleshooting

### Build Errors
```bash
# Missing FUSE3 headers
sudo apt install libfuse3-dev

# Permission issues
sudo usermod -a -G fuse $USER
# Log out and back in
```

### Runtime Errors
```bash
# Check FUSE is available
which fusermount3 || which fusermount

# Check module permissions
ls -la /dev/fuse

# Enable debug output
export DEBUG=fuse3_napi
```

### Module Not Found
If the addon can't be loaded, check:
1. It's been built: `npm run build`
2. The path is correct in index.js
3. Dependencies are installed: `ldd build/Release/fuse3_napi.node`

## Future Improvements

1. **Multi-threading**: Enable FUSE multi-threaded mode for better performance
2. **More operations**: Implement remaining FUSE operations (symlink, xattr, etc.)
3. **Better error handling**: Provide more detailed error information
4. **Memory optimization**: Use object pools for frequently allocated objects
5. **Windows support**: Although FUSE doesn't work on Windows, could provide compatibility layer