import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { AuthProvider } from '../contexts/AuthContext';
import { vi } from 'vitest';

vi.mock('../lib/api', () => {
  const mockApi = {
    post: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  return { api: mockApi, publicApi: mockApi };
});

function renderLogin() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('Login page', () => {
  it('should render login form', () => {
    renderLogin();
    expect(screen.getByLabelText(/логин/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
  });

  it('should render title', () => {
    renderLogin();
    expect(screen.getByText('Kidney Office')).toBeInTheDocument();
  });

  it('should allow typing in inputs', async () => {
    const user = userEvent.setup();
    renderLogin();

    const loginInput = screen.getByLabelText(/логин/i);
    const passwordInput = screen.getByLabelText(/пароль/i);

    await user.type(loginInput, 'admin');
    await user.type(passwordInput, 'password123');

    expect(loginInput).toHaveValue('admin');
    expect(passwordInput).toHaveValue('password123');
  });

  it('should show loading state on submit', async () => {
    const { api } = await import('../lib/api');
    (api.post as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/логин/i), 'admin');
    await user.type(screen.getByLabelText(/пароль/i), 'pass');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    expect(screen.getByRole('button')).toHaveTextContent('Вход...');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show error on failed login', async () => {
    const { api } = await import('../lib/api');
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { message: 'Invalid login or password' } },
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/логин/i), 'bad');
    await user.type(screen.getByLabelText(/пароль/i), 'bad');
    await user.click(screen.getByRole('button', { name: /войти/i }));

    expect(
      await screen.findByText('Invalid login or password'),
    ).toBeInTheDocument();
  });
});
