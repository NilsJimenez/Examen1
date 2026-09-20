with open('backend/app/models/usuario.py', 'r') as f:
    lines = f.read()

lines = lines.replace(
    'fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)\n\n    # Relaciones\n    rol: Mapped["Rol"] = relationship("Rol", back_populates="usuarios")',
    'fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)\n    reset_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)\n    reset_code_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)\n\n    # Relaciones\n    rol: Mapped["Rol"] = relationship("Rol", back_populates="usuarios")'
)

lines = lines.replace(
    'fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)\n\n    # Relaciones\n    reservas: Mapped[list["Reserva"]] = relationship("Reserva", back_populates="cliente")',
    'fecha_registro: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)\n    reset_code: Mapped[Optional[str]] = mapped_column(String(6), nullable=True)\n    reset_code_expires: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)\n\n    # Relaciones\n    reservas: Mapped[list["Reserva"]] = relationship("Reserva", back_populates="cliente")'
)

with open('backend/app/models/usuario.py', 'w') as f:
    f.write(lines)
