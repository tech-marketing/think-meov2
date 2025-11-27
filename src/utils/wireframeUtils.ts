import { WireframeElement } from '@/hooks/useWireframeLayout';

export interface Point {
  x: number;
  y: number;
}

export interface SnapGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  elements: string[];
}

export const ASPECT_RATIOS = {
  '1:1': { width: 400, height: 400, label: 'Quadrado' },
  '4:5': { width: 400, height: 500, label: 'Instagram Portrait' },
  '9:16': { width: 400, height: 711, label: 'Stories' },
  '16:9': { width: 400, height: 225, label: 'Landscape' }
};

export const SNAP_TOLERANCE = 6; // pixels
export const GRID_SIZES = [4, 8, 12, 16, 24, 32];

// Convert percentage to pixels based on container size
export const percentToPixels = (percent: number, containerSize: number): number => {
  return (percent / 100) * containerSize;
};

// Convert pixels to percentage based on container size
export const pixelsToPercent = (pixels: number, containerSize: number): number => {
  return (pixels / containerSize) * 100;
};

// Snap value to grid
export const snapToGrid = (value: number, gridSize: number, containerSize: number): number => {
  const pixelValue = percentToPixels(value, containerSize);
  const snappedPixel = Math.round(pixelValue / gridSize) * gridSize;
  return pixelsToPercent(snappedPixel, containerSize);
};

// Calculate snapping guides for elements
export const calculateSnapGuides = (
  elements: WireframeElement[],
  excludeId?: string
): SnapGuide[] => {
  const guides: SnapGuide[] = [];
  const tolerance = 2; // percentage tolerance for snapping

  const filteredElements = elements.filter(el => el.id !== excludeId);

  // Vertical guides (left, center, right edges)
  const verticalPositions = new Map<number, string[]>();
  
  filteredElements.forEach(el => {
    const left = Math.round(el.left);
    const center = Math.round(el.left + el.width / 2);
    const right = Math.round(el.left + el.width);

    // Collect elements at each position
    [left, center, right].forEach(pos => {
      if (!verticalPositions.has(pos)) {
        verticalPositions.set(pos, []);
      }
      verticalPositions.get(pos)!.push(el.id);
    });
  });

  // Create vertical guides
  verticalPositions.forEach((elementIds, position) => {
    guides.push({
      type: 'vertical',
      position,
      elements: elementIds
    });
  });

  // Horizontal guides (top, middle, bottom edges)
  const horizontalPositions = new Map<number, string[]>();
  
  filteredElements.forEach(el => {
    const top = Math.round(el.top);
    const middle = Math.round(el.top + el.height / 2);
    const bottom = Math.round(el.top + el.height);

    [top, middle, bottom].forEach(pos => {
      if (!horizontalPositions.has(pos)) {
        horizontalPositions.set(pos, []);
      }
      horizontalPositions.get(pos)!.push(el.id);
    });
  });

  // Create horizontal guides
  horizontalPositions.forEach((elementIds, position) => {
    guides.push({
      type: 'horizontal',
      position,
      elements: elementIds
    });
  });

  return guides;
};

// Find nearest snap position
export const findNearestSnap = (
  value: number,
  guides: SnapGuide[],
  type: 'vertical' | 'horizontal',
  tolerance: number = 2
): number | null => {
  const relevantGuides = guides.filter(guide => guide.type === type);
  
  let nearestDistance = tolerance + 1;
  let nearestPosition: number | null = null;

  relevantGuides.forEach(guide => {
    const distance = Math.abs(value - guide.position);
    if (distance <= tolerance && distance < nearestDistance) {
      nearestDistance = distance;
      nearestPosition = guide.position;
    }
  });

  return nearestPosition;
};

// Apply smart snapping to element position
export const applySmartSnapping = (
  element: WireframeElement,
  newLeft: number,
  newTop: number,
  allElements: WireframeElement[],
  snapToGridEnabled: boolean,
  gridSize: number,
  containerWidth: number,
  containerHeight: number
): { left: number; top: number; snapped: boolean } => {
  let snappedLeft = newLeft;
  let snappedTop = newTop;
  let hasSnapped = false;

  // Grid snapping
  if (snapToGridEnabled) {
    snappedLeft = snapToGrid(newLeft, gridSize, containerWidth);
    snappedTop = snapToGrid(newTop, gridSize, containerHeight);
    if (snappedLeft !== newLeft || snappedTop !== newTop) {
      hasSnapped = true;
    }
  } else {
    // Element snapping
    const guides = calculateSnapGuides(allElements, element.id);
    
    // Check left edge snapping
    const leftSnap = findNearestSnap(newLeft, guides, 'vertical');
    if (leftSnap !== null) {
      snappedLeft = leftSnap;
      hasSnapped = true;
    }

    // Check center snapping
    const centerSnap = findNearestSnap(newLeft + element.width / 2, guides, 'vertical');
    if (centerSnap !== null) {
      snappedLeft = centerSnap - element.width / 2;
      hasSnapped = true;
    }

    // Check right edge snapping
    const rightSnap = findNearestSnap(newLeft + element.width, guides, 'vertical');
    if (rightSnap !== null) {
      snappedLeft = rightSnap - element.width;
      hasSnapped = true;
    }

    // Check top edge snapping
    const topSnap = findNearestSnap(newTop, guides, 'horizontal');
    if (topSnap !== null) {
      snappedTop = topSnap;
      hasSnapped = true;
    }

    // Check middle snapping
    const middleSnap = findNearestSnap(newTop + element.height / 2, guides, 'horizontal');
    if (middleSnap !== null) {
      snappedTop = middleSnap - element.height / 2;
      hasSnapped = true;
    }

    // Check bottom edge snapping
    const bottomSnap = findNearestSnap(newTop + element.height, guides, 'horizontal');
    if (bottomSnap !== null) {
      snappedTop = bottomSnap - element.height;
      hasSnapped = true;
    }
  }

  // Ensure element stays within bounds
  snappedLeft = Math.max(0, Math.min(100 - element.width, snappedLeft));
  snappedTop = Math.max(0, Math.min(100 - element.height, snappedTop));

  return {
    left: snappedLeft,
    top: snappedTop,
    snapped: hasSnapped
  };
};

// Calculate element spacing and distribution
export const distributeElements = (
  elements: WireframeElement[],
  direction: 'horizontal' | 'vertical'
): WireframeElement[] => {
  if (elements.length < 3) return elements;

  const sortedElements = [...elements].sort((a, b) => {
    return direction === 'horizontal' ? a.left - b.left : a.top - b.top;
  });

  const firstElement = sortedElements[0];
  const lastElement = sortedElements[sortedElements.length - 1];
  
  const totalDistance = direction === 'horizontal' 
    ? (lastElement.left + lastElement.width) - firstElement.left
    : (lastElement.top + lastElement.height) - firstElement.top;

  const spacing = totalDistance / (elements.length - 1);

  return sortedElements.map((element, index) => {
    if (index === 0 || index === elements.length - 1) {
      return element; // Don't move first and last elements
    }

    if (direction === 'horizontal') {
      return {
        ...element,
        left: firstElement.left + (spacing * index) - (element.width / 2)
      };
    } else {
      return {
        ...element,
        top: firstElement.top + (spacing * index) - (element.height / 2)
      };
    }
  });
};

// Check if element is in safe area (for different aspect ratios)
export const isInSafeArea = (
  element: WireframeElement,
  aspectRatio: string,
  safeAreaPercent: number = 90
): boolean => {
  const margin = (100 - safeAreaPercent) / 2;
  
  const elementRight = element.left + element.width;
  const elementBottom = element.top + element.height;
  
  return (
    element.left >= margin &&
    element.top >= margin &&
    elementRight <= (100 - margin) &&
    elementBottom <= (100 - margin)
  );
};

// Generate layout variations for different aspect ratios
export const adaptLayoutToAspectRatio = (
  elements: WireframeElement[],
  fromRatio: string,
  toRatio: string
): WireframeElement[] => {
  const fromDimensions = ASPECT_RATIOS[fromRatio as keyof typeof ASPECT_RATIOS];
  const toDimensions = ASPECT_RATIOS[toRatio as keyof typeof ASPECT_RATIOS];
  
  if (!fromDimensions || !toDimensions) {
    return elements; // Return unchanged if ratios are invalid
  }

  const widthScale = toDimensions.width / fromDimensions.width;
  const heightScale = toDimensions.height / fromDimensions.height;

  return elements.map(element => ({
    ...element,
    left: Math.min(90, element.left * widthScale),
    top: Math.min(90, element.top * heightScale),
    width: Math.min(100 - element.left, element.width * widthScale),
    height: Math.min(100 - element.top, element.height * heightScale)
  }));
};

// Validate layout constraints
export interface LayoutValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validateLayout = (elements: WireframeElement[]): LayoutValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  elements.forEach(element => {
    // Check if element is within bounds
    if (element.left < 0 || element.top < 0 || 
        element.left + element.width > 100 || 
        element.top + element.height > 100) {
      errors.push(`Elemento ${element.id} está fora dos limites`);
    }

    // Check minimum sizes
    if (element.width < 5 || element.height < 2) {
      warnings.push(`Elemento ${element.id} pode estar muito pequeno`);
    }

    // Check maximum sizes
    if (element.width > 95 || element.height > 95) {
      warnings.push(`Elemento ${element.id} pode estar muito grande`);
    }
  });

  // Check for overlapping elements (warning, not error)
  for (let i = 0; i < elements.length; i++) {
    for (let j = i + 1; j < elements.length; j++) {
      const el1 = elements[i];
      const el2 = elements[j];
      
      const overlap = !(
        el1.left + el1.width <= el2.left ||
        el2.left + el2.width <= el1.left ||
        el1.top + el1.height <= el2.top ||
        el2.top + el2.height <= el1.top
      );

      if (overlap) {
        warnings.push(`Elementos ${el1.id} e ${el2.id} estão sobrepostos`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};