/**
 * Docking System Persistence Tests
 * Tests for layout persistence across editor restarts
 */

import { dockingSystem } from './dockingSystem.js';

/**
 * Test suite for docking system layout persistence
 */
export const DockingSystemTests = {
  /**
   * Test 1: Verify layout is saved to localStorage
   */
  async testLayoutSavesToStorage() {
    console.log('🧪 Test 1: Layout saves to localStorage');
    
    // Get initial state
    const initialStats = dockingSystem.getPersistenceStats();
    console.log('   Initial stats:', initialStats);
    
    // Make a change
    const leftPanel = document.getElementById('leftPanel');
    if (leftPanel) {
      dockingSystem.dockWindow('hierarchy', 'left', 350);
    }
    
    // Verify it was saved
    const stats = dockingSystem.getPersistenceStats();
    console.log('   After dock operation:', stats);
    
    if (stats.exists && stats.windowCount > 0) {
      console.log('   ✅ PASS: Layout saved to storage');
      return true;
    } else {
      console.log('   ❌ FAIL: Layout not found in storage');
      return false;
    }
  },

  /**
   * Test 2: Verify debounced saves don't write excessively during drag
   */
  async testDebouncedSaves() {
    console.log('🧪 Test 2: Debounced saves during drag operations');
    
    const savesBefore = (dockingSystem.lastSaveTime || 0);
    
    // Simulate drag move (should debounce, not save immediately)
    const dragState = {
      id: 'hierarchy',
      startX: 100,
      startY: 100,
      currentX: 0,
      currentY: 0,
    };
    dockingSystem.draggingWindow = dragState;
    
    // Call drag move multiple times
    for (let i = 0; i < 5; i++) {
      const event = new MouseEvent('mousemove', { clientX: 100 + i * 10, clientY: 100 + i * 10 });
      dockingSystem._onDragMove(event);
    }
    
    // Should have pending save but not written yet (debounced)
    const hasPending = dockingSystem.pendingSave;
    console.log('   Pending save queued:', hasPending);
    
    if (hasPending) {
      console.log('   ✅ PASS: Debounce working - save pending');
      return true;
    } else {
      console.log('   ⚠️  WARNING: Debounce may not be active');
      return false;
    }
  },

  /**
   * Test 3: Verify floating window state is persisted
   */
  async testFloatingWindowPersistence() {
    console.log('🧪 Test 3: Floating window state persistence');
    
    const rightPanel = document.getElementById('rightPanel');
    if (!rightPanel) {
      console.log('   ⚠️  SKIP: Right panel not found');
      return null;
    }
    
    // Float a window
    dockingSystem.floatWindow('inspector', 200, 150, 500, 400);
    
    // Get layout state
    const state = dockingSystem.getLayoutState();
    const inspectorWindow = state.windows.find(w => w.id === 'inspector');
    
    console.log('   Inspector window state:', inspectorWindow);
    
    if (inspectorWindow && inspectorWindow.state === 'floating') {
      console.log('   ✅ PASS: Floating state persisted');
      return true;
    } else {
      console.log('   ❌ FAIL: Floating state not persisted');
      return false;
    }
  },

  /**
   * Test 4: Verify state validation on load
   */
  async testLayoutValidation() {
    console.log('🧪 Test 4: Layout state validation on load');
    
    // Create invalid layout data
    const invalidData = {
      version: 1,
      windows: [
        { id: 'unknown', state: 'invalid' },
        { id: 'hierarchy', state: 'docked', dockedSide: 'left' },
      ],
    };
    
    try {
      localStorage.setItem(dockingSystem.storageKey, JSON.stringify(invalidData));
      
      // Try to load - should handle invalid data gracefully
      const loadResult = dockingSystem.loadLayout();
      
      console.log('   Load result:', loadResult);
      console.log('   ✅ PASS: Invalid data handled gracefully');
      return true;
    } catch (e) {
      console.log('   ❌ FAIL: Exception thrown during validation:', e);
      return false;
    }
  },

  /**
   * Test 5: Verify persistence can be disabled
   */
  async testPersistenceControl() {
    console.log('🧪 Test 5: Persistence can be enabled/disabled');
    
    const initialState = dockingSystem.isPersistenceActive();
    console.log('   Initial persistence state:', initialState);
    
    // Disable persistence
    dockingSystem.setPersistenceEnabled(false);
    const disabledState = dockingSystem.isPersistenceActive();
    console.log('   After disable:', disabledState);
    
    // Re-enable persistence
    dockingSystem.setPersistenceEnabled(true);
    const enabledState = dockingSystem.isPersistenceActive();
    console.log('   After enable:', enabledState);
    
    if (!disabledState && enabledState) {
      console.log('   ✅ PASS: Persistence control working');
      return true;
    } else {
      console.log('   ❌ FAIL: Persistence control not working');
      return false;
    }
  },

  /**
   * Test 6: Verify unload saves pending layouts
   */
  async testUnloadFlush() {
    console.log('🧪 Test 6: Pending saves flush on unload');
    
    // Queue a debounced save
    dockingSystem.dockWindow('hierarchy', 'left', 300);
    
    const hasPending = dockingSystem.pendingSave;
    console.log('   Pending save before flush:', hasPending);
    
    // Flush pending saves
    dockingSystem._flushPendingSaves();
    
    const afterFlush = dockingSystem.pendingSave;
    console.log('   Pending save after flush:', afterFlush);
    
    if (hasPending && !afterFlush) {
      console.log('   ✅ PASS: Pending saves flushed on unload');
      return true;
    } else {
      console.log('   ⚠️  WARNING: Flush behavior unclear');
      return false;
    }
  },

  /**
   * Test 7: Storage size reasonable
   */
  async testStorageSize() {
    console.log('🧪 Test 7: Storage size is reasonable');
    
    const stats = dockingSystem.getPersistenceStats();
    console.log('   Storage stats:', stats);
    
    if (stats.exists && stats.sizeInBytes > 0) {
      const sizeKb = (stats.sizeInBytes / 1024).toFixed(2);
      console.log(`   Layout size: ${sizeKb} KB`);
      
      if (stats.sizeInBytes < 50000) { // Less than 50KB
        console.log('   ✅ PASS: Storage size reasonable');
        return true;
      } else {
        console.log('   ⚠️  WARNING: Storage size larger than expected');
        return false;
      }
    } else {
      console.log('   ⚠️  SKIP: No layout saved yet');
      return null;
    }
  },

  /**
   * Run all tests
   */
  async runAll() {
    console.log('\n========================================');
    console.log('🧪 Docking System Persistence Tests');
    console.log('========================================\n');

    const results = {};
    
    results.test1 = await this.testLayoutSavesToStorage();
    results.test2 = await this.testDebouncedSaves();
    results.test3 = await this.testFloatingWindowPersistence();
    results.test4 = await this.testLayoutValidation();
    results.test5 = await this.testPersistenceControl();
    results.test6 = await this.testUnloadFlush();
    results.test7 = await this.testStorageSize();

    // Summary
    console.log('\n========================================');
    console.log('📊 Test Summary');
    console.log('========================================');
    
    const passed = Object.values(results).filter(r => r === true).length;
    const failed = Object.values(results).filter(r => r === false).length;
    const skipped = Object.values(results).filter(r => r === null).length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📈 Total: ${Object.keys(results).length}`);
    
    // Export results for inspection
    window.dockingSystemTestResults = results;
    console.log('\n💡 Access results via: window.dockingSystemTestResults');
    
    return results;
  },
};

// Make tests available globally for console access
if (typeof window !== 'undefined') {
  window.DockingSystemTests = DockingSystemTests;
}
