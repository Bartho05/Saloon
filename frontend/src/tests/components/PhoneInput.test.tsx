import { render, screen, fireEvent } from '@testing-library/react';
import { PhoneInput } from '@components/PhoneInput';

describe('PhoneInput', () => {
  it('renders with label', () => {
    render(<PhoneInput label="Telefone" value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Telefone')).toBeInTheDocument();
  });

  it('applies mask correctly', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    
    const input = screen.getByPlaceholderText(/\(\d{2}\)/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '11999999999' } });
    
    expect(input.value).toBe('(11) 99999-9999');
    expect(onChange).toHaveBeenCalledWith('11999999999');
  });

  it('shows error when invalid', () => {
    render(<PhoneInput value="123" onChange={vi.fn()} error="Telefone inválido" />);
    expect(screen.getByText('Telefone inválido')).toBeInTheDocument();
  });

  it('auto-completes 10-digit landline to mobile', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    
    const input = screen.getByPlaceholderText(/\(\d{2}\)/);
    fireEvent.change(input, { target: { value: '1133334444' } });
    fireEvent.blur(input);
    
    expect(onChange).toHaveBeenCalledWith('11933334444');
  });

  it('shows valid indicator when complete', () => {
    render(<PhoneInput value="11999999999" onChange={vi.fn()} />);
    expect(screen.getByText('Telefone válido')).toBeInTheDocument();
  });

  it('calls onEnterPress when Enter pressed', () => {
    const onEnterPress = vi.fn();
    render(<PhoneInput value="(11) 99999-9999" onChange={vi.fn()} onEnterPress={onEnterPress} />);
    
    const input = screen.getByPlaceholderText(/\(\d{2}\)/);
    fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(onEnterPress).toHaveBeenCalled();
  });
});
