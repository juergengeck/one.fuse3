# one.fuse3

Native IFileSystem to FUSE3 bridge for one.filer - provides high-performance Linux filesystem integration for ONE content.

## Overview

This N-API module enables one.filer to expose ONE database content as a virtual Linux filesystem using FUSE3 (Filesystem in Userspace). It provides the same functionality as one.projfs but for Linux/WSL environments.

**Architecture**: Linux File Manager → FUSE3 → one.fuse3 → IFileSystem

This provides seamless access to ONE content through standard Linux filesystem operations with native performance.

## Key Features

- **FUSE3 Integration** - Native FUSE3 bindings using N-API for Node.js
- **Cross-Platform** - Works on Linux, WSL2, and other Unix-like systems
- **IFileSystem Bridge** - Direct integration with ONE's IFileSystem interface
- **High Performance** - Native C++ implementation with minimal overhead
- **Type-Safe** - Full TypeScript support with proper IFileSystem types
- **Production Ready** - Based on proven FUSE3 library used in production systems

## Installation

```bash
npm install @refinio/one.fuse3
```

**Requirements**:
- Linux or WSL2 (FUSE3 not supported in WSL1)
- FUSE3 library: `sudo apt-get install fuse3 libfuse3-dev`
- Node.js 20.0.0 or later
- Build tools: `sudo apt-get install build-essential`

## Role in one.filer

This module is used by one.filer to provide a virtual filesystem that users interact with on Linux:

1. **User Experience**: Users see a virtual mount point (e.g., `/tmp/one-filer`) in their file manager
2. **Content Access**: Browse ONE content like regular files:
   - `/tmp/one-filer/chats/person@example.com/general/message.txt`
   - `/tmp/one-filer/debug/connections.json`
   - `/tmp/one-filer/objects/[hash]/content`
3. **Performance**: Near-native filesystem performance for all operations

## Usage

### Integration with one.filer

```javascript
// In one.filer/src/filer/FilerWithFUSE.ts
import { Fuse3 } from '@refinio/one.fuse3';
import { CombinedFileSystem } from '@refinio/one.models/lib/fileSystems/CombinedFileSystem.js';

export class FilerWithFUSE {
    async initFUSE(): Promise<void> {
        // Create combined filesystem with all components
        const fileSystems = [
            new ChatFileSystem(...),
            new ObjectsFileSystem(...),
            new DebugFileSystem(...),
            new TypesFileSystem(...)
        ];

        const rootFS = new CombinedFileSystem(fileSystems);

        // Mount using one.fuse3
        this.fuse = new Fuse3('/tmp/one-filer', {
            getattr: async (path) => rootFS.stat(path),
            readdir: async (path) => rootFS.readDir(path),
            open: async (path) => rootFS.open(path),
            read: async (path, offset, length) => rootFS.read(path, offset, length),
            release: async (path) => rootFS.close(path)
        });

        await this.fuse.mount();
        // Users can now access ONE content at /tmp/one-filer!
    }
}
```

### TypeScript Integration

```typescript
import { Fuse3 } from '@refinio/one.fuse3';
import { ChatFileSystem } from '@refinio/one.models/lib/fileSystems/ChatFileSystem.js';

// Create your filesystem
const chatFS = new ChatFileSystem(leuteModel, topicModel, channelManager);

// Mount it via FUSE3
const fuse = new Fuse3('/tmp/one-filer', {
    getattr: async (path) => {
        const stat = await chatFS.stat(path);
        return {
            mode: stat.isDirectory ? 0o040755 : 0o100644,
            size: stat.size || 0,
            mtime: stat.mtime || Date.now(),
            atime: stat.atime || Date.now(),
            ctime: stat.ctime || Date.now()
        };
    },
    readdir: async (path) => {
        return await chatFS.readDir(path);
    },
    read: async (path, offset, length) => {
        const fd = await chatFS.open(path, 'r');
        const buffer = Buffer.alloc(length);
        await chatFS.read(fd, buffer, 0, length, offset);
        await chatFS.close(fd);
        return buffer;
    }
});

await fuse.mount();

// Now Linux file managers show your chat content!
```

## What Users See

When one.filer uses this module, users get a virtual Linux mount with their ONE content:

```
/tmp/one-filer/
├── chats/                      # From ChatFileSystem
│   ├── person@example.com/
│   │   └── general/
│   │       ├── message1.txt
│   │       └── message2.txt
├── files/                      # From FilesFileSystem
│   └── documents/
│       ├── report.pdf         # Direct BLOB access
│       └── image.jpg          # Direct BLOB access
├── debug/                      # Debug information
├── invites/                    # Pairing invitations
│   ├── iop_invite.txt         # Instance of Person invite
│   └── iom_invite.txt         # Instance of Machine invite
└── types/                      # Type definitions
```

## Technical Architecture

### FUSE3 Operations

The module implements standard FUSE3 operations:

- **getattr**: Get file/directory attributes (size, permissions, timestamps)
- **readdir**: List directory contents
- **open**: Open file for reading
- **read**: Read file content at offset
- **release**: Close file handle
- **readlink**: Read symbolic link target (optional)
- **statfs**: Get filesystem statistics (optional)

### Platform Compatibility

| Platform | Status | Notes |
|----------|--------|-------|
| Linux (native) | ✅ Supported | Full FUSE3 support |
| WSL2 | ✅ Supported | Full FUSE3 support via Linux kernel |
| WSL1 | ❌ Not Supported | WSL1 doesn't support FUSE |
| macOS | 🔄 Not Tested | Requires macFUSE, not officially supported |

### Cross-Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE Application                           │
├─────────────────────────────────────────────────────────────┤
│              IFileSystem (Platform Independent)              │
├──────────────────────┬──────────────────────────────────────┤
│    one.projfs        │         one.fuse3                     │
│  (Windows ProjFS)    │      (Linux/WSL FUSE3)                │
├──────────────────────┼──────────────────────────────────────┤
│   Windows Explorer   │      Linux File Manager               │
└──────────────────────┴──────────────────────────────────────┘
```

## Building from Source

```bash
# Install dependencies
npm install

# Configure build
npm run configure

# Build native addon
npm run build

# Or rebuild from scratch
npm run rebuild

# Clean build artifacts
npm run clean
```

**Build Requirements**:
- Node.js 20+
- FUSE3 development headers: `libfuse3-dev`
- C++ compiler: `g++` or `clang`
- Python 3 (for node-gyp)
- pkg-config

## Testing

### Unit Tests

```bash
npm test
```

### Integration Test

The package includes a connection integration test that verifies:
1. FUSE3 mount is accessible
2. Invite files are exposed correctly
3. Invite content is valid
4. Ready for connection establishment

```bash
# Run integration test (requires ONE Filer running)
node test/integration/connection-test.js

# With custom mount point
ONE_FILER_MOUNT=/mnt/one-filer node test/integration/connection-test.js
```

### Manual Testing in WSL2

```bash
# In WSL2
cd /path/to/one.filer
node dist/index.js --fuse-mount /tmp/one-filer

# In another WSL2 terminal
ls -la /tmp/one-filer
cat /tmp/one-filer/invites/iop_invite.txt
```

## Performance

FUSE3 provides excellent performance for userspace filesystems:

| Operation | Native Filesystem | one.fuse3 | Overhead |
|-----------|------------------|-----------|----------|
| Metadata (stat) | <0.1ms | 0.5-1ms | ~5-10x |
| Directory list | 0.5-1ms | 2-5ms | ~3-5x |
| Small file read | 0.5-1ms | 2-5ms | ~3-5x |
| Large file read | I/O bound | I/O bound | Minimal |

The overhead is acceptable for most use cases and significantly better than network-based solutions.

## Connection Testing

The integration test verifies the complete invite flow:

```bash
# Test on Linux/WSL2
node test/integration/connection-test.js

# Expected output:
# ✅ FUSE3 mount point accessible
# ✅ Invites directory accessible
# ✅ IOP invite file exists
# ✅ IOM invite file exists
# ✅ IOP invite readable
# ✅ IOM invite readable
# ✅ IOP invite valid
# ✅ IOM invite valid
```

## Troubleshooting

### FUSE3 not available
```bash
# Install FUSE3
sudo apt-get update
sudo apt-get install fuse3 libfuse3-dev

# Verify installation
fusermount3 --version
```

### Permission denied
```bash
# Add user to fuse group
sudo usermod -a -G fuse $USER

# Logout and login again for group change to take effect
```

### Module not found after install
```bash
# Rebuild native addon
npm run rebuild

# Check build output
ls -la build/Release/
```

### WSL1 not supported
```bash
# Check WSL version
wsl --list --verbose

# Upgrade to WSL2 if needed
wsl --set-version Ubuntu 2
```

### Mount fails with "Transport endpoint is not connected"
```bash
# Unmount stale mount
fusermount3 -u /tmp/one-filer

# Or force unmount
sudo umount -l /tmp/one-filer

# Try mount again
```

## Comparison with one.projfs

| Feature | one.projfs (Windows) | one.fuse3 (Linux) |
|---------|---------------------|-------------------|
| Platform | Windows 10 1809+ | Linux, WSL2 |
| Technology | ProjFS | FUSE3 |
| Virtualization | On-demand hydration | Standard FUSE ops |
| Performance | Excellent | Very Good |
| Setup | Requires Windows feature | Requires FUSE3 package |
| Use Case | Windows desktops | Linux servers, WSL2 |

Both provide similar functionality adapted to their respective platforms.

## License

MIT

## Contributing

Contributions welcome! Please ensure:
- Code compiles on Linux and WSL2
- Tests pass: `npm test`
- Integration test works: `node test/integration/connection-test.js`
- Follows existing code style

## Links

- [FUSE3 Documentation](https://github.com/libfuse/libfuse)
- [N-API Documentation](https://nodejs.org/api/n-api.html)
- [one.projfs (Windows equivalent)](https://github.com/refinio/one.projfs)
- [IFileSystem Interface](https://github.com/refinio/one.core)
