import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProcessesService } from './processes.service';
import { Process } from './entities/process.entity';
import { ProcessVersion } from './entities/process-version.entity';
import { ProcessDepartment } from './entities/process-department.entity';
import { ProcessDepartmentUser } from './entities/process-department-user.entity';
import { ProcessAttachment } from './entities/process-attachment.entity';
import { ProcessActivityLog } from './entities/process-activity-log.entity';
import { ProcessReadState } from './entities/process-read-state.entity';
import { User } from '../users/entities/user.entity';
import { AppSetting } from '../settings/entities/app-setting.entity';
import { PushNotificationsService } from './push-notifications.service';
import { ChecklistAiService } from './checklist-ai.service';
import {
  createMockRepository,
  MockRepository,
} from '../test/mock-repository.factory';
import { createMockUser } from '../test/mock-user.factory';

describe('ProcessesService', () => {
  let service: ProcessesService;
  let departmentsRepo: MockRepository;
  let processesRepo: MockRepository;
  let versionsRepo: MockRepository;
  let usersRepo: MockRepository;
  let pushNotifications: { getPublicKey: jest.Mock };

  beforeEach(async () => {
    departmentsRepo = createMockRepository();
    processesRepo = createMockRepository();
    versionsRepo = createMockRepository();
    usersRepo = createMockRepository();
    pushNotifications = { getPublicKey: jest.fn().mockReturnValue('test-key') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessesService,
        { provide: getRepositoryToken(ProcessDepartment), useValue: departmentsRepo },
        { provide: getRepositoryToken(Process), useValue: processesRepo },
        { provide: getRepositoryToken(ProcessVersion), useValue: versionsRepo },
        { provide: getRepositoryToken(ProcessAttachment), useValue: createMockRepository() },
        { provide: getRepositoryToken(ProcessActivityLog), useValue: createMockRepository() },
        { provide: getRepositoryToken(ProcessDepartmentUser), useValue: createMockRepository() },
        { provide: getRepositoryToken(ProcessReadState), useValue: createMockRepository() },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(AppSetting), useValue: createMockRepository() },
        { provide: PushNotificationsService, useValue: pushNotifications },
        { provide: ChecklistAiService, useValue: { suggestChecklists: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn((cb: any) => cb({ getRepository: () => createMockRepository() })) } },
      ],
    }).compile();

    service = module.get<ProcessesService>(ProcessesService);
  });

  describe('createDepartment', () => {
    it('should create a root department', async () => {
      departmentsRepo.create!.mockImplementation((data: any) => data);
      departmentsRepo.save!.mockImplementation((data: any) =>
        Promise.resolve({ id: 'dep-1', ...data }),
      );

      const result = await service.createDepartment({ name: 'Test Department' });
      expect(result.name).toBe('Test Department');
      expect(result.parentId).toBeNull();
    });

    it('should create a child department', async () => {
      departmentsRepo.findOne!.mockResolvedValue({ id: 'parent-1', name: 'Parent' });
      departmentsRepo.create!.mockImplementation((data: any) => data);
      departmentsRepo.save!.mockImplementation((data: any) =>
        Promise.resolve({ id: 'dep-2', ...data }),
      );

      const result = await service.createDepartment({
        name: 'Child',
        parentId: 'parent-1',
      });
      expect(result.parentId).toBe('parent-1');
    });

    it('should throw when parent department not found', async () => {
      departmentsRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.createDepartment({ name: 'Child', parentId: 'bad-id' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDepartment', () => {
    it('should throw when setting self as parent', async () => {
      departmentsRepo.findOne!.mockResolvedValue({ id: 'dep-1', name: 'Test' });

      await expect(
        service.updateDepartment('dep-1', { parentId: 'dep-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('moveProcesses', () => {
    it('should throw when source equals target', async () => {
      departmentsRepo.findOne!.mockResolvedValue({ id: 'dep-1' });

      await expect(
        service.moveProcesses('dep-1', 'dep-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUsersForAssignment', () => {
    it('should return active users', async () => {
      usersRepo.find!.mockResolvedValue([
        { id: 'u1', login: 'user1', displayName: 'User One', isActive: true },
        { id: 'u2', login: 'user2', displayName: 'User Two', isActive: true },
      ]);

      const result = await service.getUsersForAssignment();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'u1',
        login: 'user1',
        displayName: 'User One',
      });
    });
  });

  describe('getPushPublicKey', () => {
    it('should return VAPID public key', () => {
      const result = service.getPushPublicKey();
      expect(result).toEqual({ publicKey: 'test-key' });
    });
  });
});
