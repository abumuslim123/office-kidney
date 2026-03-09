import { Test, TestingModule } from '@nestjs/testing';
import { ProcessesController } from './processes.controller';
import { ProcessesService } from './processes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MockJwtAuthGuard, MockPermissionsGuard } from '../test/mock-guards';
import { createMockUser } from '../test/mock-user.factory';

describe('ProcessesController', () => {
  let controller: ProcessesController;
  let service: Record<string, jest.Mock>;

  beforeEach(async () => {
    service = {
      getDepartmentTree: jest.fn(),
      getUsersForAssignment: jest.fn(),
      getPushPublicKey: jest.fn(),
      createDepartment: jest.fn(),
      updateDepartment: jest.fn(),
      deleteDepartment: jest.fn(),
      getProcessesByDepartment: jest.fn(),
      createProcess: jest.fn(),
      findProcessById: jest.fn(),
      updateProcess: jest.fn(),
      deleteProcess: jest.fn(),
      createVersion: jest.fn(),
      getVersions: jest.fn(),
      getVersion: jest.fn(),
      approveProcess: jest.fn(),
      markProcessAsRead: jest.fn(),
      subscribePush: jest.fn(),
      unsubscribePush: jest.fn(),
      getDepartmentProcessCount: jest.fn(),
      moveProcesses: jest.fn(),
      getDepartmentUsers: jest.fn(),
      setDepartmentUsers: jest.fn(),
      getProcessActivity: jest.fn(),
      suggestChecklists: jest.fn(),
      applyVersion: jest.fn(),
      updateVersionCorrections: jest.fn(),
      deleteVersion: jest.fn(),
      uploadAttachment: jest.fn(),
      getAttachment: jest.fn(),
      deleteAttachment: jest.fn(),
      getPolzaSettings: jest.fn(),
      updatePolzaSettings: jest.fn(),
      acknowledgeLatestVersion: jest.fn(),
      forceAcknowledgeProcess: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessesController],
      providers: [{ provide: ProcessesService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .overrideGuard(PermissionsGuard)
      .useClass(MockPermissionsGuard)
      .compile();

    controller = module.get<ProcessesController>(ProcessesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDepartmentTree', () => {
    it('should call service.getDepartmentTree', async () => {
      const user = createMockUser();
      const tree = [{ id: 'dep-1', name: 'Dept', children: [] }];
      service.getDepartmentTree.mockResolvedValue(tree);

      const result = await controller.getDepartmentTree(user);
      expect(result).toEqual(tree);
      expect(service.getDepartmentTree).toHaveBeenCalledWith(user);
    });
  });

  describe('createDepartment', () => {
    it('should call service.createDepartment', async () => {
      const dto = { name: 'New Dept' };
      service.createDepartment.mockResolvedValue({ id: 'dep-1', ...dto });

      const result = await controller.createDepartment(dto);
      expect(result.name).toBe('New Dept');
    });
  });

  describe('deleteDepartment', () => {
    it('should return success', async () => {
      service.deleteDepartment.mockResolvedValue(undefined);
      const result = await controller.deleteDepartment('dep-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('createProcess', () => {
    it('should call service.createProcess with user', async () => {
      const user = createMockUser();
      const dto = { title: 'New Process', departmentId: 'dep-1' } as any;
      service.createProcess.mockResolvedValue({ id: 'proc-1', ...dto });

      const result = await controller.createProcess(dto, user);
      expect(result.title).toBe('New Process');
      expect(service.createProcess).toHaveBeenCalledWith(dto, user);
    });
  });

  describe('approveProcess', () => {
    it('should call service.approveProcess', async () => {
      const user = createMockUser();
      service.approveProcess.mockResolvedValue({ success: true });

      const result = await controller.approveProcess('proc-1', user);
      expect(result).toEqual({ success: true });
      expect(service.approveProcess).toHaveBeenCalledWith('proc-1', user);
    });
  });

  describe('deleteProcess', () => {
    it('should return success', async () => {
      service.deleteProcess.mockResolvedValue(undefined);
      const result = await controller.deleteProcess('proc-1');
      expect(result).toEqual({ success: true });
    });
  });
});
