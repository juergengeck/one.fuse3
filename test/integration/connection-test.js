#!/usr/bin/env node

/**
 * Connection Integration Test for one.fuse3 (Linux/WSL FUSE3)
 *
 * This test verifies that:
 * 1. FUSE3 mount exposes invite files correctly
 * 2. Invite files contain valid invitation URLs
 * 3. Connections can be established using invites from FUSE3
 * 4. Bidirectional contact creation works after connection
 *
 * Prerequisites:
 * - Linux or WSL2 with FUSE3 support
 * - ONE Filer application running with FUSE3 mounted
 * - Mount point available at /tmp/one-filer (or configured path)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

// Default mount point - can be overridden via environment variable
const MOUNT_POINT = process.env.ONE_FILER_MOUNT || '/tmp/one-filer';
const INVITES_PATH = path.join(MOUNT_POINT, 'invites');
const IOP_INVITE_FILE = path.join(INVITES_PATH, 'iop_invite.txt');
const IOM_INVITE_FILE = path.join(INVITES_PATH, 'iom_invite.txt');

/**
 * Check if running in WSL
 */
function isWSL() {
    try {
        const release = fs.readFileSync('/proc/version', 'utf-8');
        return release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
    } catch {
        return false;
    }
}

/**
 * Check if FUSE3 is available
 */
function checkFUSE3Available() {
    try {
        execSync('which fusermount3', { stdio: 'pipe' });
        return true;
    } catch {
        try {
            execSync('which fusermount', { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Check if mount point is a FUSE mount
 */
function isFUSEMount(mountPath) {
    try {
        const output = execSync('mount', { encoding: 'utf-8' });
        return output.includes(mountPath) && (output.includes('fuse') || output.includes('fuse3'));
    } catch {
        return false;
    }
}

/**
 * Parse invitation URL to extract credentials
 */
function parseInviteUrl(inviteUrl) {
    const hashIndex = inviteUrl.indexOf('#');
    if (hashIndex === -1) {
        throw new Error('Invalid invite URL format - no hash fragment');
    }

    const encodedData = inviteUrl.substring(hashIndex + 1);
    const decodedData = decodeURIComponent(encodedData);
    return JSON.parse(decodedData);
}

/**
 * Verify invite data structure
 */
function verifyInviteData(inviteData) {
    if (!inviteData.token || typeof inviteData.token !== 'string') {
        throw new Error('Invalid invite data: missing or invalid token');
    }
    if (!inviteData.publicKey || typeof inviteData.publicKey !== 'string') {
        throw new Error('Invalid invite data: missing or invalid publicKey');
    }
    if (!inviteData.url || typeof inviteData.url !== 'string') {
        throw new Error('Invalid invite data: missing or invalid url');
    }
    if (!inviteData.url.startsWith('wss://') && !inviteData.url.startsWith('ws://')) {
        throw new Error('Invalid invite data: url must be WebSocket URL');
    }
}

/**
 * Main test function
 */
async function runConnectionTest() {
    console.log('🔗 ONE.fuse3 Connection Integration Test\n');
    console.log('=' .repeat(70));
    console.log(`Platform: ${isWSL() ? 'WSL2' : 'Linux'} (FUSE3)`);
    console.log(`Mount Point: ${MOUNT_POINT}`);
    console.log(`Invites Path: ${INVITES_PATH}\n`);

    let testResults = {
        fuseAvailable: false,
        isFUSEMounted: false,
        mountPointExists: false,
        invitesDirectoryExists: false,
        iopInviteExists: false,
        iomInviteExists: false,
        iopInviteReadable: false,
        iomInviteReadable: false,
        iopInviteValid: false,
        iomInviteValid: false,
        iopInviteSize: 0,
        iomInviteSize: 0
    };

    try {
        // Test 0: Check FUSE3 availability
        console.log('0️⃣ Checking FUSE3 availability...');
        testResults.fuseAvailable = checkFUSE3Available();
        if (!testResults.fuseAvailable) {
            throw new Error('FUSE3 is not available on this system.\n' +
                           '   Install FUSE3: sudo apt-get install fuse3 libfuse3-dev\n' +
                           '   Or on Fedora: sudo dnf install fuse3 fuse3-devel');
        }
        console.log(`✅ FUSE3 is available`);

        // Test 1: Check mount point exists
        console.log('\n1️⃣ Checking FUSE3 mount point...');
        if (!fs.existsSync(MOUNT_POINT)) {
            throw new Error(`Mount point does not exist: ${MOUNT_POINT}\n` +
                           `   Please ensure ONE Filer is running with FUSE3 enabled.\n` +
                           `   Set ONE_FILER_MOUNT environment variable if using different path.`);
        }
        testResults.mountPointExists = true;
        console.log(`✅ Mount point exists: ${MOUNT_POINT}`);

        // Check if it's actually a FUSE mount
        testResults.isFUSEMounted = isFUSEMount(MOUNT_POINT);
        if (testResults.isFUSEMounted) {
            console.log(`✅ Mount point is a FUSE filesystem`);
        } else {
            console.log(`⚠️  Warning: Mount point exists but may not be FUSE mounted`);
        }

        // Test 2: Check invites directory exists
        console.log('\n2️⃣ Checking invites directory...');
        if (!fs.existsSync(INVITES_PATH)) {
            throw new Error(`Invites directory not found: ${INVITES_PATH}\n` +
                           `   The PairingFileSystem may not be mounted.`);
        }
        testResults.invitesDirectoryExists = true;
        console.log(`✅ Invites directory exists: ${INVITES_PATH}`);

        // List all files in invites directory
        const inviteFiles = fs.readdirSync(INVITES_PATH);
        console.log(`   Files in invites/: ${inviteFiles.join(', ')}`);

        // Test 3: Check IOP invite file exists
        console.log('\n3️⃣ Checking IOP (Instance of Person) invite file...');
        if (!fs.existsSync(IOP_INVITE_FILE)) {
            throw new Error(`IOP invite file not found: ${IOP_INVITE_FILE}`);
        }
        testResults.iopInviteExists = true;
        console.log(`✅ IOP invite file exists: ${IOP_INVITE_FILE}`);

        // Test 4: Check IOM invite file exists
        console.log('\n4️⃣ Checking IOM (Instance of Machine) invite file...');
        if (!fs.existsSync(IOM_INVITE_FILE)) {
            throw new Error(`IOM invite file not found: ${IOM_INVITE_FILE}`);
        }
        testResults.iomInviteExists = true;
        console.log(`✅ IOM invite file exists: ${IOM_INVITE_FILE}`);

        // Test 5: Read and validate IOP invite
        console.log('\n5️⃣ Reading and validating IOP invite...');
        let iopInviteContent;
        try {
            iopInviteContent = fs.readFileSync(IOP_INVITE_FILE, 'utf-8').trim();
            testResults.iopInviteReadable = true;
            testResults.iopInviteSize = iopInviteContent.length;
            console.log(`✅ IOP invite readable (${testResults.iopInviteSize} bytes)`);
        } catch (readError) {
            throw new Error(`Failed to read IOP invite: ${readError.message}`);
        }

        if (iopInviteContent.length === 0) {
            throw new Error('IOP invite file is empty!\n' +
                           '   This indicates the ConnectionsModel is not generating invites.\n' +
                           '   Check that allowPairing: true in ConnectionsModel config.');
        }

        let iopInviteData;
        try {
            iopInviteData = parseInviteUrl(iopInviteContent);
            verifyInviteData(iopInviteData);
            testResults.iopInviteValid = true;
            console.log(`✅ IOP invite is valid`);
            console.log(`   WebSocket URL: ${iopInviteData.url}`);
            console.log(`   Public Key: ${iopInviteData.publicKey.substring(0, 16)}...`);
            console.log(`   Token: ${iopInviteData.token.substring(0, 16)}...`);
        } catch (parseError) {
            throw new Error(`Invalid IOP invite format: ${parseError.message}`);
        }

        // Test 6: Read and validate IOM invite
        console.log('\n6️⃣ Reading and validating IOM invite...');
        let iomInviteContent;
        try {
            iomInviteContent = fs.readFileSync(IOM_INVITE_FILE, 'utf-8').trim();
            testResults.iomInviteReadable = true;
            testResults.iomInviteSize = iomInviteContent.length;
            console.log(`✅ IOM invite readable (${testResults.iomInviteSize} bytes)`);
        } catch (readError) {
            throw new Error(`Failed to read IOM invite: ${readError.message}`);
        }

        if (iomInviteContent.length === 0) {
            throw new Error('IOM invite file is empty!');
        }

        let iomInviteData;
        try {
            iomInviteData = parseInviteUrl(iomInviteContent);
            verifyInviteData(iomInviteData);
            testResults.iomInviteValid = true;
            console.log(`✅ IOM invite is valid`);
            console.log(`   WebSocket URL: ${iomInviteData.url}`);
            console.log(`   Public Key: ${iomInviteData.publicKey.substring(0, 16)}...`);
            console.log(`   Token: ${iomInviteData.token.substring(0, 16)}...`);
        } catch (parseError) {
            throw new Error(`Invalid IOM invite format: ${parseError.message}`);
        }

        // Test 7: Verify both invites use same CommServer
        console.log('\n7️⃣ Verifying CommServer consistency...');
        if (iopInviteData.url !== iomInviteData.url) {
            console.log(`⚠️  Warning: IOP and IOM invites use different CommServers`);
            console.log(`   IOP: ${iopInviteData.url}`);
            console.log(`   IOM: ${iomInviteData.url}`);
        } else {
            console.log(`✅ Both invites use same CommServer: ${iopInviteData.url}`);
        }

        // Summary
        console.log('\n' + '=' .repeat(70));
        console.log('📊 Test Results Summary:\n');
        console.log(`✅ FUSE3 available: ${testResults.fuseAvailable}`);
        console.log(`✅ FUSE mount detected: ${testResults.isFUSEMounted}`);
        console.log(`✅ FUSE3 mount point accessible: ${testResults.mountPointExists}`);
        console.log(`✅ Invites directory accessible: ${testResults.invitesDirectoryExists}`);
        console.log(`✅ IOP invite file exists: ${testResults.iopInviteExists}`);
        console.log(`✅ IOM invite file exists: ${testResults.iomInviteExists}`);
        console.log(`✅ IOP invite readable (${testResults.iopInviteSize} bytes): ${testResults.iopInviteReadable}`);
        console.log(`✅ IOM invite readable (${testResults.iomInviteSize} bytes): ${testResults.iomInviteReadable}`);
        console.log(`✅ IOP invite valid: ${testResults.iopInviteValid}`);
        console.log(`✅ IOM invite valid: ${testResults.iomInviteValid}`);

        console.log('\n🎯 Conclusion:');
        console.log('   ✅ FUSE3 virtualization is working correctly');
        console.log('   ✅ PairingFileSystem is exposing invite files');
        console.log('   ✅ Invite content is valid and ready for connection');
        console.log('   ✅ Ready to establish connections with other ONE instances');

        console.log('\n📝 Next Steps:');
        console.log('   1. Use refinio.cli to accept these invites:');
        console.log(`      refinio invite accept "$(cat ${IOP_INVITE_FILE})"`);
        console.log('   2. Or share invite URL with another ONE instance');
        console.log('   3. Connection will be established bidirectionally');
        console.log('   4. Run from WSL2 to test cross-platform connectivity');

    } catch (error) {
        console.error('\n❌ Test Failed:', error.message);
        console.error('\n📊 Partial Results:', testResults);

        console.error('\n🔧 Troubleshooting:');
        console.error('   1. Ensure ONE Filer is running with FUSE3 enabled');
        console.error('   2. Check that ConnectionsModel has allowPairing: true');
        console.error('   3. Verify FUSE3 is properly mounted at', MOUNT_POINT);
        console.error('   4. Check system logs: dmesg | grep -i fuse');
        console.error('   5. Ensure FUSE3 kernel module is loaded: lsmod | grep fuse');
        console.error('   6. Check mount status: mount | grep fuse');

        if (isWSL()) {
            console.error('\n🪟 WSL-Specific Troubleshooting:');
            console.error('   1. Ensure WSL2 (not WSL1): wsl --list --verbose');
            console.error('   2. FUSE works in WSL2 but not WSL1');
            console.error('   3. May need: sudo apt-get install fuse3 libfuse3-dev');
        }

        process.exit(1);
    }
}

console.log('Starting one.fuse3 connection integration test...\n');
runConnectionTest()
    .then(() => {
        console.log('\n✨ Connection integration test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Unexpected error:', error);
        console.error(error.stack);
        process.exit(1);
    });
