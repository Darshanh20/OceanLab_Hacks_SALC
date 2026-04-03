-- Sample Data for Knowledge Flow Platform
-- This script creates realistic workspaces, teams, users with various roles
-- Scenarios: 1) Company workspace 2) School workspace

-- ============================================================================
-- USERS
-- ============================================================================

-- Company Users
INSERT INTO users (id, email, password_hash, created_at) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'john.ceo@techcorp.com', '$2b$12$example_hash_1', NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'sarah.hr@techcorp.com', '$2b$12$example_hash_2', NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'mike.engineering@techcorp.com', '$2b$12$example_hash_3', NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'priya.senior.eng@techcorp.com', '$2b$12$example_hash_4', NOW()),
('550e8400-e29b-41d4-a716-446655440005', 'alex.junior.eng@techcorp.com', '$2b$12$example_hash_5', NOW()),
('550e8400-e29b-41d4-a716-446655440006', 'emma.sales@techcorp.com', '$2b$12$example_hash_6', NOW()),
('550e8400-e29b-41d4-a716-446655440007', 'david.product@techcorp.com', '$2b$12$example_hash_7', NOW()),
('550e8400-e29b-41d4-a716-446655440008', 'lisa.marketing@techcorp.com', '$2b$12$example_hash_8', NOW()),
('550e8400-e29b-41d4-a716-446655440009', 'james.sales2@techcorp.com', '$2b$12$example_hash_9', NOW()),

-- School Users
('550e8400-e29b-41d4-a716-446655440010', 'jane.principal@starschool.edu', '$2b$12$example_hash_10', NOW()),
('550e8400-e29b-41d4-a716-446655440011', 'dr.smith@starschool.edu', '$2b$12$example_hash_11', NOW()),
('550e8400-e29b-41d4-a716-446655440012', 'prof.williams@starschool.edu', '$2b$12$example_hash_12', NOW()),
('550e8400-e29b-41d4-a716-446655440013', 'mr.johnson@starschool.edu', '$2b$12$example_hash_13', NOW()),
('550e8400-e29b-41d4-a716-446655440014', 'maya.student@starschool.edu', '$2b$12$example_hash_14', NOW()),
('550e8400-e29b-41d4-a716-446655440015', 'rahul.student@starschool.edu', '$2b$12$example_hash_15', NOW()),
('550e8400-e29b-41d4-a716-446655440016', 'sophie.student@starschool.edu', '$2b$12$example_hash_16', NOW()),
('550e8400-e29b-41d4-a716-446655440017', 'oliver.student@starschool.edu', '$2b$12$example_hash_17', NOW());

-- ============================================================================
-- ORGANIZATIONS (Workspaces)
-- ============================================================================

INSERT INTO organizations (id, name, subscription_tier, subscription_status, owner_id, created_at) VALUES
-- Company workspace
('660e8400-e29b-41d4-a716-446655440001', 'TechCorp Inc.', 'enterprise', 'active', '550e8400-e29b-41d4-a716-446655440001', NOW()),

-- School workspace
('660e8400-e29b-41d4-a716-446655440002', 'Star School District', 'pro', 'active', '550e8400-e29b-41d4-a716-446655440010', NOW());

-- ============================================================================
-- ORGANIZATION MEMBERS
-- ============================================================================

-- TechCorp Members
INSERT INTO org_members (id, org_id, user_id, role, joined_at) VALUES
-- Owner
('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'owner', NOW()),

-- Admins
('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'admin', NOW()),
('770e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'admin', NOW()),

-- Members
('770e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440008', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 'member', NOW()),

-- Star School Members
('770e8400-e29b-41d4-a716-446655440010', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 'owner', NOW()),
('770e8400-e29b-41d4-a716-446655440011', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440011', 'admin', NOW()),
('770e8400-e29b-41d4-a716-446655440012', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440012', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440013', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440013', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440014', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440014', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440015', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440015', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440016', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440016', 'member', NOW()),
('770e8400-e29b-41d4-a716-446655440017', '660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440017', 'member', NOW());

-- ============================================================================
-- GROUPS (Teams)
-- ============================================================================

-- TechCorp Teams
INSERT INTO groups (id, org_id, name, description, created_by, created_at) VALUES
('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Engineering Team', 'Backend and frontend developers', '550e8400-e29b-41d4-a716-446655440003', NOW()),
('880e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'Sales Team', 'Sales and business development', '550e8400-e29b-41d4-a716-446655440006', NOW()),
('880e8400-e29b-41d4-a716-446655440003', '660e8400-e29b-41d4-a716-446655440001', 'HR & Administration', 'Human resources and administration', '550e8400-e29b-41d4-a716-446655440002', NOW()),
('880e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440001', 'Product & Design', 'Product management and UX/UI design', '550e8400-e29b-41d4-a716-446655440007', NOW()),
('880e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440001', 'Marketing', 'Digital marketing and content strategy', '550e8400-e29b-41d4-a716-446655440008', NOW()),

-- Star School Teams
('880e8400-e29b-41d4-a716-446655440006', '660e8400-e29b-41d4-a716-446655440002', 'Mathematics - Grade 10 Section A', 'Advanced mathematics for class 10 section A', '550e8400-e29b-41d4-a716-446655440012', NOW()),
('880e8400-e29b-41d4-a716-446655440007', '660e8400-e29b-41d4-a716-446655440002', 'Science - Grade 10', 'Physics, Chemistry, Biology integrated lesson content', '550e8400-e29b-41d4-a716-446655440013', NOW()),
('880e8400-e29b-41d4-a716-446655440008', '660e8400-e29b-41d4-a716-446655440002', 'English Literature - Grade 9', 'English language and literary studies', '550e8400-e29b-41d4-a716-446655440012', NOW()),
('880e8400-e29b-41d4-a716-446655440009', '660e8400-e29b-41d4-a716-446655440002', 'Faculty Development', 'Professional development for all teachers', '550e8400-e29b-41d4-a716-446655440011', NOW());

-- ============================================================================
-- GROUP MEMBERS (Team Members)
-- ============================================================================

-- Engineering Team Members
INSERT INTO group_members (id, group_id, user_id, role, joined_at) VALUES
('990e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'member', NOW()),
('990e8400-e29b-41d4-a716-446655440003', '880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'member', NOW()),

-- Sales Team Members
('990e8400-e29b-41d4-a716-446655440004', '880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440006', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440005', '880e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440009', 'member', NOW()),

-- HR & Administration Team Members
('990e8400-e29b-41d4-a716-446655440006', '880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002', 'admin', NOW()),

-- Product & Design Team Members
('990e8400-e29b-41d4-a716-446655440007', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440007', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440008', '880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'member', NOW()),

-- Marketing Team Members
('990e8400-e29b-41d4-a716-446655440009', '880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 'admin', NOW()),

-- Mathematics Team Members
('990e8400-e29b-41d4-a716-446655440010', '880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440012', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440011', '880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440014', 'member', NOW()),
('990e8400-e29b-41d4-a716-446655440012', '880e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440015', 'member', NOW()),

-- Science Team Members
('990e8400-e29b-41d4-a716-446655440013', '880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440013', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440014', '880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440014', 'member', NOW()),
('990e8400-e29b-41d4-a716-446655440015', '880e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440016', 'member', NOW()),

-- English Literature Team Members
('990e8400-e29b-41d4-a716-446655440016', '880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440012', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440017', '880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440015', 'member', NOW()),
('990e8400-e29b-41d4-a716-446655440018', '880e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440017', 'member', NOW()),

-- Faculty Development Team Members
('990e8400-e29b-41d4-a716-446655440019', '880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440011', 'admin', NOW()),
('990e8400-e29b-41d4-a716-446655440020', '880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440012', 'member', NOW()),
('990e8400-e29b-41d4-a716-446655440021', '880e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440013', 'member', NOW());

-- ============================================================================
-- SAMPLE LECTURES (Optional - for testing lectures within teams)
-- ============================================================================

INSERT INTO lectures (id, user_id, title, status, org_id, group_id, transcript_text, summary_text, created_at) VALUES
-- Engineering Team Lectures
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 'Backend Architecture Best Practices', 'completed', '660e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 'This lecture covers the principles of designing scalable backend systems...', 'Learn key strategies for building robust and scalable backend architectures', NOW()),
('aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', 'React Performance Optimization', 'completed', '660e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440001', 'Deep dive into React optimization techniques including memoization, lazy loading...', 'Master React performance optimization techniques for faster applications', NOW()),

-- Sales Team Lectures
('aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440006', 'Q1 Sales Strategy and Targets', 'completed', '660e8400-e29b-41d4-a716-446655440001', '880e8400-e29b-41d4-a716-446655440002', 'Overview of Q1 sales targets, team assignments, and pipeline management...', 'Q1 sales strategy and individual target assignments', NOW()),

-- Mathematics Class Lectures
('aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440012', 'Calculus - Differentiation Fundamentals', 'completed', '660e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440006', 'Introduction to calculus focusing on derivatives and their applications...', 'Foundational concepts of differentiation in calculus', NOW()),
('aa0e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440012', 'Geometry - Circles and Properties', 'completed', '660e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440006', 'Comprehensive coverage of circle properties, theorems, and practical problems...', 'Understanding the properties and theorems related to circles in geometry', NOW()),

-- Science Class Lectures
('aa0e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440013', 'Physics - Motion and Forces', 'completed', '660e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440007', 'Newton laws of motion, kinematics, forces, and their applications in real world...', 'Fundamental concepts of motion, forces, and Newton laws', NOW()),
('aa0e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440013', 'Chemistry - Atomic Structure', 'completed', '660e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440007', 'Detailed explanation of atomic structure, electron configuration, and bonding...', 'Understanding atomic structure and electron configuration in chemistry', NOW()),

-- English Class Lectures
('aa0e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440012', 'Shakespeare - Hamlet Analysis', 'completed', '660e8400-e29b-41d4-a716-446655440002', '880e8400-e29b-41d4-a716-446655440008', 'In-depth analysis of Hamlet themes, characters, and literary devices...', 'Comprehensive analysis of Hamlet including themes and character development', NOW());

-- ============================================================================
-- SUMMARY OF DATA CREATED
-- ============================================================================
-- 
-- TECHCORP INC. (Company):
--   Owner: john.ceo@techcorp.com (John)
--   Admins: sarah.hr@techcorp.com (Sarah), mike.engineering@techcorp.com (Mike)
--   Members: 7 employees
--   Teams:
--     1. Engineering (Admin: Mike, Members: Priya, Alex)
--     2. Sales (Admin: Emma, Member: James)
--     3. HR & Administration (Admin: Sarah)
--     4. Product & Design (Admin: David, Member: Priya)
--     5. Marketing (Admin: Lisa)
--
-- STAR SCHOOL DISTRICT (School):
--   Owner: jane.principal@starschool.edu (Jane - Principal)
--   Admin: dr.smith@starschool.edu (Dr. Smith - Academic Director)
--   Members: 6 staff/students
--   Teams:
--     1. Mathematics - Grade 10 Section A (Admin: Prof. Williams, Members: Maya, Rahul)
--     2. Science - Grade 10 (Admin: Mr. Johnson, Members: Maya, Sophie)
--     3. English Literature - Grade 9 (Admin: Prof. Williams, Members: Rahul, Oliver)
--     4. Faculty Development (Admin: Dr. Smith, Members: Prof. Williams, Mr. Johnson)
--
-- Each team has sample lectures with completed status for testing queries and access controls.
-- ============================================================================
