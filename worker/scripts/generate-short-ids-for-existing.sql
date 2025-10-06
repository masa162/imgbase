-- Generate short_ids for existing images
-- Run this once to populate short_id for existing images

-- Image 1
UPDATE images SET short_id = 'a1b2c3d4' WHERE id = 'e9441efb-2646-4671-88fa-41954886cd7b';

-- Image 2
UPDATE images SET short_id = 'e5f6g7h8' WHERE id = '87110f9a-3556-4e75-8ebd-b564b43dddd4';

-- Image 3
UPDATE images SET short_id = 'i9j0k1l2' WHERE id = '10920e1e-631e-4831-bf33-cf5bb19af55a';

-- Image 4
UPDATE images SET short_id = 'm3n4o5p6' WHERE id = '21aa0fdb-2578-4b03-b216-5652c7eaf88e';

-- Image 5
UPDATE images SET short_id = 'q7r8s9t0' WHERE id = '5b5836e6-f17a-4315-aed2-54991638d332';

-- Image 6
UPDATE images SET short_id = 'u1v2w3x4' WHERE id = 'b4ba44ea-b2b2-4010-89d3-0fda0aae662e';

-- Image 7 (Real image - PXL_20250623_011922083.jpg)
UPDATE images SET short_id = 'y5z6a7b8' WHERE id = 'c54d0c76-8c5e-495d-acbb-fc9b68b2aa46';

-- Image 8 (Real image - PXL_20250623_011924136.jpg)
UPDATE images SET short_id = 'c9d0e1f2' WHERE id = '44983f30-7eea-4a58-b6c3-c13920180447';

-- Image 9 (Real image - PXL_20250623_011930134[1].webp)
UPDATE images SET short_id = 'g3h4i5j6' WHERE id = 'ee572c66-62a2-4500-b7e6-8e75e05f40d9';
